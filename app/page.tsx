import Link from "next/link";

export default function Home() {
  return (
    <div className="card">
      <h2>AI Subscription Manager</h2>
      <p>集中管理 AI 订阅、API Key、用量与费用。先从 Dashboard 开始。</p>
      <Link href="/dashboard">进入 Dashboard</Link>
    </div>
  );
}
