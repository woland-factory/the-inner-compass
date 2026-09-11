import styles from "./ErrorFallback.module.css";

// Designed fallback for uncaught render errors. Works whether or not Sentry is
// initialized. No stack trace or error code is shown to the user.
export function ErrorFallback() {
  return (
    <div className={styles.wrap} role="alert">
      <div className={styles.card}>
        <h1 className={styles.heading}>This screen ran into a problem.</h1>
        <p className={styles.body}>Reload the page to continue.</p>
        <button
          type="button"
          className={styles.button}
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    </div>
  );
}
