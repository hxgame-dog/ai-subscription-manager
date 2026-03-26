import { SyncTrigger } from "@/components/sync-trigger";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureProviders } from "@/lib/providers";
import { listProviderSyncStatuses } from "@/lib/provider-connectors";

function readAuditString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function readAuditNumber(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}

function formatWindow(windowDays: number | null) {
  if (windowDays === 1) return "最近 24h";
  if (windowDays === 7) return "最近 7d";
  if (windowDays === 30) return "最近 30d";
  return "未记录";
}

function formatDuration(startedAt: Date | null, finishedAt: Date | null) {
  if (!startedAt || !finishedAt) return "运行中 / 未记录";
  const ms = finishedAt.getTime() - startedAt.getTime();
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 100) / 10;
  return `${seconds}s`;
}

function splitJobMessage(message: string | null) {
  if (!message) return [];
  return message
    .split(" | ")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default async function UsagePage() {
  const session = await auth();
  if (!session?.user?.id) return <div className="empty-state">请先登录后再查看同步记录。</div>;

  await ensureProviders();

  const [providers, jobs, usage, spend, diagnosticLogs, syncLogs] = await Promise.all([
    prisma.provider.findMany({ where: { supportsAutoSync: true }, orderBy: { name: "asc" } }),
    prisma.syncJob.findMany({ where: { userId: session.user.id }, include: { provider: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.usageRecord.findMany({ where: { userId: session.user.id }, orderBy: { recordedAt: "desc" }, take: 20 }),
    prisma.spendRecord.findMany({ where: { userId: session.user.id }, orderBy: { recordedAt: "desc" }, take: 20 }),
    prisma.auditLog.findMany({ where: { userId: session.user.id, action: "SYNC_DIAGNOSE" }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.auditLog.findMany({ where: { userId: session.user.id, action: "SYNC_TRIGGER" }, orderBy: { createdAt: "desc" }, take: 40 }),
  ]);

  const providerStatuses = listProviderSyncStatuses(providers.map((p) => p.key));
  const statusByKey = new Map(providerStatuses.map((item) => [item.providerKey, item]));
  const providerNameByKey = new Map(providers.map((p) => [p.key, p.name]));
  const readyProviders = providerStatuses.filter((item) => item.available);
  const blockedProviders = providerStatuses.filter((item) => item.mode === "official" && !item.available);
  const syncLogByJobId = new Map(syncLogs.filter((log) => log.resourceId).map((log) => [log.resourceId as string, log]));

  const lastDiagnostic = diagnosticLogs[0] ?? null;
  const latestJob = jobs[0] ?? null;
  const latestFailedJob = jobs.find((job) => job.status === "FAILED") ?? null;
  const latestJobLog = latestJob ? syncLogByJobId.get(latestJob.id) : null;

  const initialDiagnostic = lastDiagnostic
    ? {
        providerKey: lastDiagnostic.resourceId ?? "unknown",
        outcome: lastDiagnostic.outcome as "SUCCESS" | "ERROR",
        createdAt: lastDiagnostic.createdAt.toISOString().slice(0, 19).replace("T", " "),
        summary: readAuditString(lastDiagnostic.metadata, "summary") ?? "最近一次诊断结果已恢复。",
      }
    : null;

  const latestJobWindow = readAuditNumber(latestJobLog?.metadata, "windowDays");
  const latestJobDetails = splitJobMessage(latestJob?.errorMessage ?? null);
  const latestFailedJobDetails = splitJobMessage(latestFailedJob?.errorMessage ?? null);
  const successJobs = jobs.filter((job) => job.status === "SUCCESS").length;
  const failedJobs = jobs.filter((job) => job.status === "FAILED").length;
  const latestRecommended = readyProviders[0] ?? blockedProviders[0] ?? null;

  return (
    <div className="page-stack">
      <section className="page-hero page-hero-sync-refined">
        <div className="hero-copy">
          <p className="section-kicker">Sync console</p>
          <h1>同步记录</h1>
          <p>用统一入口管理 connector 健康度、手动同步、任务回看，以及 usage / spend 落表结果。</p>
        </div>
        <div className="hero-meta">
          <div className="meta-chip">Ready <strong>{readyProviders.length}</strong></div>
          <div className="meta-chip">Jobs <strong>{jobs.length}</strong></div>
          <div className="meta-chip">Diagnostics <strong>{diagnosticLogs.length}</strong></div>
        </div>
      </section>

      <section className="grid cols-4 sync-overview-grid">
        <article className="stat-card stat-card-sync">
          <span className="stat-kicker">Connector readiness</span>
          <span className="stat-value">{readyProviders.length}</span>
          <p className="stat-note">已就绪 connector 数量，可直接进入诊断或同步。</p>
        </article>
        <article className="stat-card stat-card-sync">
          <span className="stat-kicker">Successful jobs</span>
          <span className="stat-value">{successJobs}</span>
          <p className="stat-note">最近同步任务中执行成功的次数。</p>
        </article>
        <article className="stat-card stat-card-sync">
          <span className="stat-kicker">Failed jobs</span>
          <span className="stat-value">{failedJobs}</span>
          <p className="stat-note">失败任务会自动出现在下方排障区块。</p>
        </article>
        <article className="stat-card stat-card-sync">
          <span className="stat-kicker">Recommended next step</span>
          <div className="dashboard-metric-text">{latestRecommended?.label ?? "继续扩展 connector"}</div>
          <p className="stat-note">{latestRecommended?.nextStep ?? "当前没有 ready 的 connector，先补配置或继续实现更多平台。"}</p>
        </article>
      </section>

      <section className="workspace-section workspace-section-status">
        <div className="workspace-section-head">
          <div>
            <p className="section-kicker">Actions</p>
            <h2>运行与诊断</h2>
            <p>把平台选择、窗口控制、连接诊断和手动同步统一放在一个主操作区，减少跳转和重复决策。</p>
          </div>
        </div>
        <SyncTrigger providers={providers.map((p) => ({ id: p.id, name: p.name, key: p.key }))} initialDiagnostic={initialDiagnostic} />
      </section>

      <section className="grid cols-2 sync-summary-grid">
        <article className="card sync-summary-card">
          <div className="section-head">
            <div>
              <p className="section-kicker">Overview</p>
              <h2>当前建议</h2>
              <p>优先跑通一条 ready 链路，再逐个平台扩展。</p>
            </div>
          </div>
          <div className="soft-card soft-card-quiet">
            {readyProviders.length > 0 ? (
              <>
                <strong>优先验证：{readyProviders[0]?.label}</strong>
                <span>{readyProviders[0]?.nextStep}</span>
              </>
            ) : blockedProviders.length > 0 ? (
              <>
                <strong>优先补配置：{blockedProviders[0]?.label}</strong>
                <span>{blockedProviders[0]?.nextStep}</span>
              </>
            ) : (
              <>
                <strong>下一步：实现更多真实 connector</strong>
                <span>建议先继续完善现有平台，或者补更多 provider 的真实接入。</span>
              </>
            )}
          </div>
        </article>

        {latestJob ? (
          <article className="card sync-summary-card">
            <div className="section-head">
              <div>
                <p className="section-kicker">Latest run</p>
                <h2>最近一次任务</h2>
                <p>看最近一次同步做了什么、用了多久、返回了哪些细节。</p>
              </div>
            </div>
            <div className="info-list">
              <div className="info-row"><span>平台</span><strong>{latestJob.provider?.name || "ALL"}</strong></div>
              <div className="info-row"><span>状态</span><strong>{latestJob.status}</strong></div>
              <div className="info-row"><span>时间窗口</span><strong>{formatWindow(latestJobWindow)}</strong></div>
              <div className="info-row"><span>运行时长</span><strong>{formatDuration(latestJob.startedAt, latestJob.finishedAt)}</strong></div>
              <div className="info-row"><span>记录数</span><strong>{latestJob.recordsSynced}</strong></div>
            </div>
            {latestJobDetails.length ? (
              <ul className="diagnostic-list diagnostic-list-compact">
                {latestJobDetails.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">这次任务没有附加明细，通常表示链路很干净。</div>
            )}
          </article>
        ) : null}
      </section>

      {latestFailedJob ? (
        <section className="card sync-failure-card">
          <div className="section-head">
            <div>
              <p className="section-kicker">Troubleshooting</p>
              <h2>最近失败任务排障</h2>
              <p>优先看失败摘要拆解，快速判断是配置问题、权限问题还是 provider 侧错误。</p>
            </div>
          </div>
          <div className="page-block">
            <p>
              <strong>{latestFailedJob.provider?.name || "ALL"}</strong> · {latestFailedJob.createdAt.toISOString().slice(0, 19).replace("T", " ")}
            </p>
            {latestFailedJobDetails.length ? (
              <ul className="diagnostic-list">
                {latestFailedJobDetails.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : (
              <div className="empty-state">这次失败没有拆分明细，建议先看任务表里的原始错误文本。</div>
            )}
          </div>
        </section>
      ) : null}

      <section className="workspace-section workspace-section-status">
        <div className="workspace-section-head">
          <div>
            <p className="section-kicker">Operations</p>
            <h2>任务与健康状态</h2>
            <p>先看同步任务，再看诊断历史和 connector readiness，判断是执行链路问题还是接入能力问题。</p>
          </div>
        </div>

        <section className="table-card">
          <div className="table-section">
            <div className="section-head">
              <div>
                <h2>同步任务</h2>
                <p>优先确认触发源、状态、时间窗口和拉取记录数是不是合理。</p>
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>平台</th>
                  <th>状态</th>
                  <th>记录数</th>
                  <th>触发信息</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const syncLog = syncLogByJobId.get(j.id);
                  const windowDays = readAuditNumber(syncLog?.metadata, "windowDays");
                  return (
                    <tr key={j.id}>
                      <td>{j.createdAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                      <td>{j.provider?.name || "ALL"}</td>
                      <td>
                        <span className={`badge ${j.status === "SUCCESS" ? "success" : j.status === "FAILED" ? "danger" : "info"}`}>
                          {j.status}
                        </span>
                      </td>
                      <td>{j.recordsSynced}</td>
                      <td>
                        <div>{j.trigger} · {formatWindow(windowDays)}</div>
                        {j.errorMessage ? <small>{j.errorMessage}</small> : null}
                      </td>
                    </tr>
                  );
                })}
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state">还没有同步任务。先点一次“立即同步”跑通链路。</div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <div className="split-layout sync-ops-grid">
          <section className="table-card">
            <div className="table-section">
              <div className="section-head">
                <div>
                  <h2>最近诊断历史</h2>
                  <p>刷新后也能回看最近几次 connector 诊断结果。</p>
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>平台</th>
                    <th>结果</th>
                    <th>摘要</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnosticLogs.map((log) => {
                    const providerKey = log.resourceId ?? "unknown";
                    const summary = readAuditString(log.metadata, "summary") ?? "无摘要";
                    return (
                      <tr key={log.id}>
                        <td>{log.createdAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                        <td>{providerNameByKey.get(providerKey) ?? providerKey}</td>
                        <td>
                          <span className={`badge ${log.outcome === "SUCCESS" ? "success" : "danger"}`}>{log.outcome}</span>
                        </td>
                        <td>{summary}</td>
                      </tr>
                    );
                  })}
                  {diagnosticLogs.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="empty-state">还没有诊断历史，先点一次“先做连接诊断”。</div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="table-card">
            <div className="table-section">
              <div className="section-head">
                <div>
                  <h2>Connector readiness</h2>
                  <p>只要不是 ready 状态，就不会再写 mock 数据冒充同步成功。</p>
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>平台</th>
                    <th>能力</th>
                    <th>状态</th>
                    <th>说明</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((provider) => {
                    const status = statusByKey.get(provider.key);
                    const ready = Boolean(status?.available);
                    const planned = status?.mode === "planned";
                    const missing = status?.missing?.length ? `缺少: ${status.missing.join("、")}` : "";
                    return (
                      <tr key={provider.id}>
                        <td>{provider.name}</td>
                        <td>{status?.label ?? "Planned connector"}</td>
                        <td>
                          <span className={`badge ${ready ? "success" : planned ? "info" : "danger"}`}>
                            {ready ? "READY" : planned ? "PLANNED" : "NEEDS_CONFIG"}
                          </span>
                        </td>
                        <td>
                          <div>{status?.description ?? "尚未定义 connector 能力。"}</div>
                          {missing ? <div style={{ marginTop: 6 }}>{missing}</div> : null}
                          {status?.nextStep ? <div style={{ marginTop: 6 }}>Next: {status.nextStep}</div> : null}
                          {status?.docs ? (
                            <div style={{ marginTop: 6 }}>
                              <a href={status.docs} target="_blank" rel="noreferrer">
                                查看接入文档
                              </a>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>

      <section className="workspace-section workspace-section-assets">
        <div className="workspace-section-head">
          <div>
            <p className="section-kicker">Data</p>
            <h2>同步落表结果</h2>
            <p>最后再看 usage / spend 是否按预期落表，这是验证 connector 真正跑通的最终依据。</p>
          </div>
        </div>

        <div className="split-layout sync-data-grid">
          <section className="table-card">
            <div className="table-section">
              <div className="section-head">
                <div>
                  <h2>最近用量记录</h2>
                  <p>通过最近记录，快速判断 connector 拉回来的数据形态是不是正常。</p>
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>请求</th>
                    <th>Input</th>
                    <th>Output</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((u) => (
                    <tr key={u.id}>
                      <td>{u.recordedAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                      <td>{u.requestCount}</td>
                      <td>{u.inputTokens}</td>
                      <td>{u.outputTokens}</td>
                    </tr>
                  ))}
                  {usage.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="empty-state">同步前这里会是空的，这是正常状态。</div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="table-card">
            <div className="table-section">
              <div className="section-head">
                <div>
                  <h2>最近费用记录</h2>
                  <p>预算趋势、账单对账和费用监控，后面都会以这里为基础。</p>
                </div>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>金额</th>
                    <th>币种</th>
                    <th>来源</th>
                  </tr>
                </thead>
                <tbody>
                  {spend.map((s) => (
                    <tr key={s.id}>
                      <td>{s.recordedAt.toISOString().slice(0, 19).replace("T", " ")}</td>
                      <td>{s.amount.toString()}</td>
                      <td>{s.currency}</td>
                      <td>{s.source}</td>
                    </tr>
                  ))}
                  {spend.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="empty-state">还没有费用数据，先完成一次同步后再回来看。</div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
