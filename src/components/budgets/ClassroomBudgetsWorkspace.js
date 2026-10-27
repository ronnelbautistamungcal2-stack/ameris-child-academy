import { Modal } from "@/components/training/trainingUi";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Skeleton from "@/components/ui/Skeleton";
import useSyncedCenterId from "@/hooks/useSyncedCenterId";
import { apiJson } from "@/lib/api";
import { BUDGET_PERIODS } from "@/lib/budgetPeriods";
import { useCallback, useEffect, useState } from "react";

// Classroom Budgets for admins and coaches (client requests 2026-10-02 and
// 2026-10-14): only admins add, edit or delete a budget; admins and coaches
// enter expenses. A budget runs weekly, monthly, quarterly or yearly and can
// renew automatically.

const NAVY = "text-[#0b2a5b] dark:text-blue-100";
const control = "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800";
const card = "rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900";
const EXPENSE_CATEGORIES = ["Supplies", "Materials", "Equipment", "Food", "Other"];
const PERIOD_NOUN = { WEEK: "week", MONTH: "month", QUARTER: "quarter", YEAR: "year" };

const pad = (n) => String(n).padStart(2, "0");
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;
const fmt = (key) => new Date(`${String(key).slice(0, 10)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function monthBounds(month) {
  const [y, m] = month.split("-").map(Number);
  return { from: `${month}-01`, to: `${month}-${pad(new Date(y, m, 0).getDate())}` };
}

export default function ClassroomBudgetsWorkspace() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [classes, setClasses] = useState([]);
  const [month, setMonth] = useState(() => todayKey().slice(0, 7));
  const [classRoomId, setClassRoomId] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [budgetDialog, setBudgetDialog] = useState(null); // {} new, or a budget to edit
  const [expenseFor, setExpenseFor] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind: "budget"|"expense", budget, expense? }

  useSyncedCenterId(centerId, setCenterId, centers);

  useEffect(() => {
    apiJson("/api/v1/centers")
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setCenters(list);
        if (list.length === 1) setCenterId(list[0].id);
      })
      .catch((e) => setError(e.message || "Failed to load centers"));
  }, []);

  useEffect(() => {
    if (!centerId) return setClasses([]);
    apiJson(`/api/v1/classes?centerId=${encodeURIComponent(centerId)}`)
      .then((rows) => setClasses(Array.isArray(rows) ? rows : []))
      .catch(() => setClasses([]));
  }, [centerId]);

  const load = useCallback(async () => {
    if (!centerId) return;
    setError("");
    try {
      const qs = new URLSearchParams({ centerId, ...monthBounds(month), ...(classRoomId ? { classRoomId } : {}) });
      setData(await apiJson(`/api/v1/classroom-budgets?${qs}`));
    } catch (e) {
      setError(e.message || "Failed to load budgets");
    }
  }, [centerId, month, classRoomId]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  async function onConfirm() {
    const c = confirm;
    setConfirm(null);
    try {
      if (c.kind === "budget") await apiJson(`/api/v1/classroom-budgets/${c.budget.id}`, { method: "DELETE" });
      else await apiJson(`/api/v1/classroom-budgets/${c.budget.id}/expenses/${c.expense.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e.message || "Failed to delete");
    }
  }

  const canManage = Boolean(data?.canManage);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className={`text-3xl font-black ${NAVY}`}>Classroom Budgets</h1>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm font-bold">
            Center
            <select value={centerId} onChange={(e) => setCenterId(e.target.value)} className={`${control} w-56`}>
              <option value="">Select a center...</option>
              {centers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-bold">
            Month
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={control} />
          </label>
          <label className="block text-sm font-bold">
            Classroom
            <select value={classRoomId} onChange={(e) => setClassRoomId(e.target.value)} className={`${control} w-48`}>
              <option value="">All classrooms</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          {canManage ? (
            <button type="button" onClick={() => setBudgetDialog({})} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
              + Add Budget
            </button>
          ) : null}
        </div>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

      {!centerId ? (
        <p className={`${card} text-sm text-gray-600`}>Choose a center to see its classroom budgets.</p>
      ) : !data ? (
        <Skeleton count={4} />
      ) : !data.budgets.length ? (
        <p className={`${card} text-sm text-gray-600`}>
          No classroom budgets for this month.{canManage ? " Use Add Budget to set one." : ""}
        </p>
      ) : (
        data.budgets.map((b) => (
          <BudgetCard
            key={b.id}
            budget={b}
            canManage={canManage}
            canSpend={data.canSpend}
            onAddExpense={() => setExpenseFor(b)}
            onEdit={() => setBudgetDialog(b)}
            onDelete={() => setConfirm({ kind: "budget", budget: b })}
            onDeleteExpense={(expense) => setConfirm({ kind: "expense", budget: b, expense })}
          />
        ))
      )}

      {budgetDialog ? (
        <BudgetDialog
          centerId={centerId}
          classes={classes}
          budget={budgetDialog.id ? budgetDialog : null}
          onClose={() => setBudgetDialog(null)}
          onSaved={async () => {
            setBudgetDialog(null);
            await load();
          }}
        />
      ) : null}
      {expenseFor ? (
        <ExpenseDialog
          budget={expenseFor}
          onClose={() => setExpenseFor(null)}
          onSaved={async () => {
            setExpenseFor(null);
            await load();
          }}
        />
      ) : null}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.kind === "budget" ? "Delete budget?" : "Delete expense?"}
        message={
          confirm?.kind === "budget"
            ? `The ${confirm.budget.classRoom?.name || "classroom"} budget for ${fmt(confirm.budget.startDate)} – ${fmt(confirm.budget.endDate)} and its expenses will be removed.`
            : `"${confirm?.expense?.description}" will be removed.`
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={onConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

function BudgetCard({ budget: b, canManage, canSpend, onAddExpense, onEdit, onDelete, onDeleteExpense }) {
  const pct = b.allocatedAmount > 0 ? Math.min(100, Math.round((b.spent / b.allocatedAmount) * 100)) : 0;
  const bar = pct > 90 ? "bg-red-500" : pct > 70 ? "bg-amber-500" : "bg-emerald-500";
  const periodLabel = BUDGET_PERIODS.find((p) => p.value === b.period)?.label || "Monthly";
  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className={`text-lg font-black ${NAVY}`}>{b.classRoom?.name || "Classroom"}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {periodLabel} · {fmt(b.startDate)} – {fmt(b.endDate)}
            {b.autoRenew ? <span className="ml-2 rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">Renews every {PERIOD_NOUN[b.period]}</span> : null}
          </div>
          {b.notes ? <div className="mt-1 text-xs text-gray-500">{b.notes}</div> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {canSpend ? (
            <button type="button" onClick={onAddExpense} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700">+ Add Expense</button>
          ) : null}
          {canManage ? (
            <>
              <button type="button" onClick={onEdit} className="rounded-lg border border-blue-300 px-3 py-1.5 text-sm font-bold text-blue-700 hover:bg-blue-50">Edit</button>
              <button type="button" onClick={onDelete} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-bold text-red-600 hover:bg-red-50">Delete</button>
            </>
          ) : null}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[["Budget", money(b.allocatedAmount)], ["Spent", money(b.spent)], ["Remaining", money(b.remaining)]].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-blue-50 p-3 dark:bg-gray-800">
            <div className="text-xs font-bold text-gray-600 dark:text-gray-400">{label}</div>
            <div className={`text-xl font-black ${NAVY}`}>{value}</div>
          </div>
        ))}
        <div className="rounded-lg bg-blue-50 p-3 dark:bg-gray-800">
          <div className="text-xs font-bold text-gray-600 dark:text-gray-400">Used</div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
          </div>
          <div className={`mt-1 text-sm font-black ${NAVY}`}>{pct}%</div>
        </div>
      </div>
      {b.expenses.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-blue-50 text-left text-[#0b2a5b] dark:bg-gray-800 dark:text-blue-100">
              <tr>{["Description", "Amount", "Date", "Category", "Entered By", ""].map((h) => <th key={h} className="px-3 py-2 font-bold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {b.expenses.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2 font-semibold">{e.description}</td>
                  <td className="px-3 py-2">{money(e.amount)}</td>
                  <td className="px-3 py-2">{fmt(new Date(e.date).toISOString())}</td>
                  <td className="px-3 py-2">{e.category}</td>
                  <td className="px-3 py-2">{e.recordedBy?.name || "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {canSpend ? <button type="button" onClick={() => onDeleteExpense(e)} className="text-xs font-semibold text-red-600 hover:underline">Delete</button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function BudgetDialog({ centerId, classes, budget, onClose, onSaved }) {
  const isEdit = Boolean(budget);
  const [form, setForm] = useState(() => ({
    classRoomId: budget?.classRoomId || "",
    allocatedAmount: budget?.allocatedAmount ?? "",
    period: budget?.period || "MONTH",
    startDate: budget?.startDate || `${todayKey().slice(0, 7)}-01`,
    autoRenew: budget ? budget.autoRenew : true,
    notes: budget?.notes || "",
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    setSaving(true);
    setError("");
    try {
      if (isEdit) {
        await apiJson(`/api/v1/classroom-budgets/${budget.id}`, {
          method: "PUT",
          body: JSON.stringify({ allocatedAmount: form.allocatedAmount, autoRenew: form.autoRenew, notes: form.notes }),
        });
      } else {
        await apiJson("/api/v1/classroom-budgets", { method: "POST", body: JSON.stringify({ ...form, centerId }) });
      }
      await onSaved();
    } catch (e) {
      setError(e.message || "Failed to save the budget");
      setSaving(false);
    }
  }

  return (
    <Modal
      title={isEdit ? "Edit Budget" : "Add Budget"}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-bold">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Saving..." : "Save Budget"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-bold">
            Classroom
            <select value={form.classRoomId} onChange={(e) => set({ classRoomId: e.target.value })} disabled={isEdit} className={control}>
              <option value="">Select a classroom...</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-bold">
            Budget Amount ($)
            <input type="number" min="0" step="0.01" value={form.allocatedAmount} onChange={(e) => set({ allocatedAmount: e.target.value })} className={control} />
          </label>
          <label className="block text-sm font-bold">
            How Often
            <select value={form.period} onChange={(e) => set({ period: e.target.value })} disabled={isEdit} className={control}>
              {BUDGET_PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </label>
          <label className="block text-sm font-bold">
            Start Date
            <input type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} disabled={isEdit} className={control} />
          </label>
        </div>
        <label className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm dark:bg-gray-800">
          <input type="checkbox" checked={form.autoRenew} onChange={(e) => set({ autoRenew: e.target.checked })} className="mt-0.5" />
          <span>
            <span className="block font-bold">Auto renew</span>
            <span className="block text-xs text-gray-600 dark:text-gray-400">
              Start a new {PERIOD_NOUN[form.period]} with the same amount when this one ends.
            </span>
          </span>
        </label>
        <label className="block text-sm font-bold">
          Notes
          <input value={form.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={500} className={control} />
        </label>
      </div>
    </Modal>
  );
}

function ExpenseDialog({ budget, onClose, onSaved }) {
  const [form, setForm] = useState({ description: "", amount: "", date: todayKey(), category: "Supplies" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    setSaving(true);
    setError("");
    try {
      await apiJson(`/api/v1/classroom-budgets/${budget.id}/expenses`, { method: "POST", body: JSON.stringify(form) });
      await onSaved();
    } catch (e) {
      setError(e.message || "Failed to add the expense");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Add Expense"
      label={`Add expense to ${budget.classRoom?.name || "classroom"}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-bold">Cancel</button>
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
            {saving ? "Saving..." : "Add Expense"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">{budget.classRoom?.name} · {fmt(budget.startDate)} – {fmt(budget.endDate)}</p>
        {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        <label className="block text-sm font-bold">
          Description
          <input value={form.description} onChange={(e) => set({ description: e.target.value })} className={control} />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm font-bold">
            Amount ($)
            <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => set({ amount: e.target.value })} className={control} />
          </label>
          <label className="block text-sm font-bold">
            Date
            <input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} className={control} />
          </label>
          <label className="block text-sm font-bold">
            Category
            <select value={form.category} onChange={(e) => set({ category: e.target.value })} className={control}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
      </div>
    </Modal>
  );
}
