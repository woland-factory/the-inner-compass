import { Link } from "react-router-dom";
import styles from "./Landing.module.css";

export function Landing() {
  return (
    <section className={styles.landing}>
      <h1 className={styles.title}>The Inner Compass</h1>
      <p className={styles.tagline}>
        Find out how well you know which way things really are.
      </p>

      <Link to="/guess" className={styles.primary}>
        Start a walk
      </Link>
    </section>
  );
}
