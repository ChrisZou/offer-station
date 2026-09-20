import { listJobs, removeAllJobs, removeJob, saveJob, updateJobStatus, type SavedJobInput } from "../../../db/jobs";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Test-Reset",
  "Cache-Control": "no-store",
};

function json(body: unknown, init: ResponseInit = {}) {
  return Response.json(body, { ...init, headers: { ...cors, ...init.headers } });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function GET(request: Request) {
  try {
    const limitValue = Number(new URL(request.url).searchParams.get("limit") || 100);
    const jobs = await listJobs(Math.min(Math.max(limitValue, 1), 100));
    return json({ jobs });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "读取岗位失败" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as SavedJobInput;
    if (!body.title?.trim() || !body.company?.trim()) {
      return json({ error: "职位名称和公司名称不能为空" }, { status: 400 });
    }
    const result = await saveJob(body);
    return json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "保存岗位失败" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as { id?: string; status?: string };
    if (!body.id?.trim() || !body.status?.trim()) return json({ error: "缺少岗位 ID 或求职状态" }, { status: 400 });
    const job = await updateJobStatus(body.id.trim(), body.status.trim());
    return json({ job });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "更新求职状态失败" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("reset") === "all") {
      const localOnly = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
      const confirmed = request.headers.get("X-Test-Reset") === "RESET";
      if (!localOnly || !confirmed) return json({ error: "完整重置仅允许在本地测试环境使用" }, { status: 403 });
      await removeAllJobs();
      return json({ ok: true, reset: true });
    }
    const id = url.searchParams.get("id")?.trim();
    if (!id) return json({ error: "缺少岗位 ID" }, { status: 400 });
    await removeJob(id);
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "删除岗位失败" }, { status: 500 });
  }
}
