import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="page max-w-prose py-20">
      <p className="font-display text-4xl font-extrabold text-moss">404</p>
      <h1 className="mt-2 font-display text-3xl font-extrabold">This page does not exist</h1>
      <p className="mt-3">The link may be old or mistyped. Start a new check from the scan page.</p>
      <Link to="/" className="btn-primary mt-6">
        Go to scan
      </Link>
    </div>
  );
}
