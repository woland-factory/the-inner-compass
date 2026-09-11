import { Outlet } from "react-router-dom";
import styles from "./Shell.module.css";

// Mobile-first layout: a single centered content column with a minimal header.
export function Shell() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>The Inner Compass</span>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
