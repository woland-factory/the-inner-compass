import { Link, Outlet } from "react-router-dom";
import styles from "./Shell.module.css";

// Mobile-first layout: a single centered content column with a minimal header.
export function Shell() {
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand}>
          The Inner Compass
        </Link>
        <Link to="/record" className={styles.nav}>
          Record
        </Link>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}
