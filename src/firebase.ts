import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  query, 
  where,
  orderBy
} from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";
import { Child, TaskLog, SummaryReport } from "./types";

enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

// Error Mapper following the 3rd pillar of the skill
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
    },
    operationType,
    path,
  };
  console.error("Firestore Core Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Check if Firebase is realistically configured
const isRealFirebase = 
  firebaseConfig.projectId && 
  !firebaseConfig.projectId.startsWith("PLACEHOLDER") &&
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.startsWith("PLACEHOLDER");

let appInstance: any = null;
let dbInstance: any = null;
let authInstance: any = null;

if (isRealFirebase) {
  try {
    appInstance = initializeApp(firebaseConfig);
    // Explicit db mapping as instructed: getFirestore(app, config.firestoreDatabaseId)
    dbInstance = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId || undefined);
    authInstance = getAuth(appInstance);
    console.log("Firebase initialized successfully with project:", firebaseConfig.projectId);
  } catch (err) {
    console.warn("Failed to initialize Firebase SDK:", err);
  }
} else {
  console.log("Using browser LocalStorage as client fallback (Firebase is not yet configured).");
}

export const db = dbInstance;
export const auth = authInstance;

// Helper to check standard LocalStorage database initial values
const defaultChildren: Child[] = [
  {
    id: "kate",
    name: "Kate",
    year: "Year 8",
    passcode: "1111",
    subjects: ["中文 Chinese", "英文 English", "數學 Mathematics", "Flute (琴/長笛練習)"],
  },
  {
    id: "damon",
    name: "Damon",
    year: "Year 4",
    passcode: "2222",
    subjects: ["中文 Chinese", "英文 English", "數學 Mathematics", "Piano (鋼琴練習)"],
  },
];

// Initialize LocalStorage if empty
const initializeLocalStorage = () => {
  if (!localStorage.getItem("kids_tracker_children")) {
    localStorage.setItem("kids_tracker_children", JSON.stringify(defaultChildren));
  }
  if (!localStorage.getItem("kids_tracker_logs")) {
    localStorage.setItem("kids_tracker_logs", JSON.stringify([]));
  }
  if (!localStorage.getItem("kids_tracker_summaries")) {
    localStorage.setItem("kids_tracker_summaries", JSON.stringify([]));
  }
  if (!localStorage.getItem("kids_tracker_settings")) {
    localStorage.setItem("kids_tracker_settings", JSON.stringify({ parentPasscode: "8888" }));
  }
};

// Run initialization in the browser context
if (typeof window !== "undefined") {
  initializeLocalStorage();
}

// DATABASE SERVICE ACTIONS (With automatic fallback)

/**
 * Fetch Children Profiles
 */
export async function getChildren(): Promise<Child[]> {
  if (dbInstance) {
    try {
      const colRef = collection(dbInstance, "children");
      const snapshot = await getDocs(colRef);
      if (snapshot.empty) {
        // Bootstrap Firestore children profiles on first load if empty
        for (const child of defaultChildren) {
          await setDoc(doc(dbInstance, "children", child.id), child);
        }
        return defaultChildren;
      }
      return snapshot.docs.map(d => d.data() as Child);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "children");
    }
  }

  // Fallback to local storage
  const raw = localStorage.getItem("kids_tracker_children");
  return raw ? JSON.parse(raw) : defaultChildren;
}

/**
 * Save Child Profile (e.g. customized subjects or passcodes)
 */
export async function saveChild(child: Child): Promise<void> {
  if (dbInstance) {
    try {
      await setDoc(doc(dbInstance, "children", child.id), child);
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `children/${child.id}`);
    }
  }

  // Fallback
  const children = await getChildren();
  const index = children.findIndex(c => c.id === child.id);
  if (index >= 0) {
    children[index] = child;
  } else {
    children.push(child);
  }
  localStorage.setItem("kids_tracker_children", JSON.stringify(children));
}

/**
 * Fetch Historical Homework Completion Logs
 */
export async function getTaskLogs(): Promise<TaskLog[]> {
  if (dbInstance) {
    try {
      const colRef = collection(dbInstance, "taskLogs");
      const snapshot = await getDocs(query(colRef, orderBy("date", "desc")));
      return snapshot.docs.map(d => d.data() as TaskLog);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "taskLogs");
    }
  }

  // Fallback
  const raw = localStorage.getItem("kids_tracker_logs");
  const logsList: TaskLog[] = raw ? JSON.parse(raw) : [];
  // Sort logs by date descending
  return logsList.sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Save a Task Checkoff Record
 */
export async function saveTaskLog(log: TaskLog): Promise<void> {
  if (dbInstance) {
    try {
      const docRef = doc(dbInstance, "taskLogs", log.id);
      await setDoc(docRef, log);
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `taskLogs/${log.id}`);
    }
  }

  // Fallback
  const logs = await getTaskLogs();
  const index = logs.findIndex(l => l.id === log.id);
  if (index >= 0) {
    logs[index] = log;
  } else {
    logs.push(log);
  }
  localStorage.setItem("kids_tracker_logs", JSON.stringify(logs));
}

/**
 * Fetch AI Summaries
 */
export async function getSummaryReports(): Promise<SummaryReport[]> {
  if (dbInstance) {
    try {
      const colRef = collection(dbInstance, "summaryReports");
      const snapshot = await getDocs(query(colRef, orderBy("createdAt", "desc")));
      return snapshot.docs.map(d => d.data() as SummaryReport);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, "summaryReports");
    }
  }

  // Fallback
  const raw = localStorage.getItem("kids_tracker_summaries");
  const list: SummaryReport[] = raw ? JSON.parse(raw) : [];
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Save AI Summary
 */
export async function saveSummaryReport(report: SummaryReport): Promise<void> {
  if (dbInstance) {
    try {
      await setDoc(doc(dbInstance, "summaryReports", report.id), report);
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `summaryReports/${report.id}`);
    }
  }

  // Fallback
  const reportList = await getSummaryReports();
  const index = reportList.findIndex(r => r.id === report.id);
  if (index >= 0) {
    reportList[index] = report;
  } else {
    reportList.push(report);
  }
  localStorage.setItem("kids_tracker_summaries", JSON.stringify(reportList));
}

/**
 * Parent Global Settings Auth
 */
export function getParentPasscode(): string {
  const settings = localStorage.getItem("kids_tracker_settings");
  if (settings) {
    return JSON.parse(settings).parentPasscode || "8888";
  }
  return "8888";
}

export function saveParentPasscode(pass: string): void {
  localStorage.setItem("kids_tracker_settings", JSON.stringify({ parentPasscode: pass }));
}
