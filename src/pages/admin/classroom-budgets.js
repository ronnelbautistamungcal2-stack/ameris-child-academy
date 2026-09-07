import AdminLayout from "@/components/admin/AdminLayout";
import {
  Card,
  EmptyCard,
  FilterInput,
  FilterSelect,
  KpiCard,
  Loading,
  PrimaryButton,
  SaveButton,
} from "@/components/admin/AdminUiKit";
import { apiJson } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";

const EXPENSE_CATEGORIES = [
  "Supplies",
  "Materials",
  "Equipment",
  "Food",
  "Other",
];

function today() {
  return new Date().toISOString().split("T")[0];
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString() : "";
}

export default function ClassroomBudgets() {
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [classes, setClasses] = useState([]);
  const [loadingCenters, setLoadingCenters] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const c = await apiJson("/api/v1/centers");
        const arr = Array.isArray(c) ? c : [];
        setCenters(arr);
        if (arr.length === 1) setCenterId(arr[0].id);
      } catch {
      } finally {
        setLoadingCenters(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!centerId) {
      setClasses([]);
      return;
    }
    (async () => {
      const cls = await apiJson(
        `/api/v1/classes?centerId=${encodeURIComponent(centerId)}`,
      ).catch(() => []);
      setClasses(Array.isArray(cls) ? cls : []);
    })();
  }, [centerId]);

  const selectedCenter = centers.find((c) => c.id === centerId);

  return (
    <AdminLayout title="Classroom Budgets">
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-xl font-extrabold text-gray-900">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-lg">
                  💰
                </span>
                Classroom Budgets
              </h2>
              <p className="mt-1.5 text-sm text-gray-500">
                Allocate a monthly budget per classroom and track spending against it.
              </p>
            </div>
            <div className="min-w-[220px]">
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wider text-gray-400">
                Center
              </div>
              <select
                value={centerId}
                onChange={(e) => setCenterId(e.target.value)}
                disabled={loadingCenters}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-semibold text-gray-900 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Select a center…</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedCenter && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              {selectedCenter.name} — {classes.length} classroom
              {classes.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {!centerId ? (
          <EmptyCard
            icon="🏫"
            title="No center selected"
            msg="Select a center above to manage classroom budgets."
          />
        ) : (
          <BudgetsTab centerId={centerId} classes={classes} />
        )}
      </div>
    </AdminLayout>
  );
}

function BudgetsTab({ centerId, classes }) {
  const [budgets, setBudgets] = useState([]);
  const [month, setMonth] = useState(currentMonth());
  const [classRoomId, setClassRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    classRoomId: "",
    allocatedAmount: "",
    notes: "",
  });
  const [expenseForm, setExpenseForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const qs = `centerId=${centerId}&month=${month}${classRoomId ? `&classRoomId=${classRoomId}` : ""}`;
      const data = await apiJson(`/api/v1/classroom-budgets?${qs}`);
      setBudgets(Array.isArray(data) ? data : []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [centerId, month, classRoomId]);

  useEffect(() => {
    loadBudgets();
  }, [loadBudgets]);

  const handleSetBudget = async (e) => {
    e.preventDefault();
    if (!budgetForm.classRoomId || !budgetForm.allocatedAmount) return;
    setSaving(true);
    try {
      await apiJson("/api/v1/classroom-budgets", {
        method: "POST",
        body: JSON.stringify({
          centerId,
          classRoomId: budgetForm.classRoomId,
          month,
          allocatedAmount: parseFloat(budgetForm.allocatedAmount),
          notes: budgetForm.notes || null,
        }),
      });
      setShowBudgetForm(false);
      setBudgetForm({ classRoomId: "", allocatedAmount: "", notes: "" });
      loadBudgets();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm || !expenseForm.description || !expenseForm.amount) return;
    setSaving(true);
    try {
      await apiJson(
        `/api/v1/classroom-budgets/${expenseForm.budgetId}/expenses`,
        {
          method: "POST",
          body: JSON.stringify({
            description: expenseForm.description,
            amount: parseFloat(expenseForm.amount),
            date: expenseForm.date || today(),
            category: expenseForm.category || "Other",
          }),
        },
      );
      setExpenseForm(null);
      loadBudgets();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (budgetId, expenseId) => {
    if (!confirm("Delete this expense?")) return;
    try {
      await apiJson(
        `/api/v1/classroom-budgets/${budgetId}/expenses/${expenseId}`,
        { method: "DELETE" },
      );
      loadBudgets();
    } catch {}
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <FilterInput
              label="Month"
              type="month"
              value={month}
              onChange={setMonth}
            />
            <FilterSelect
              label="Classroom"
              value={classRoomId}
              onChange={setClassRoomId}
            >
              <option value="">All classrooms</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FilterSelect>
          </div>
          <PrimaryButton onClick={() => setShowBudgetForm(!showBudgetForm)}>
            {showBudgetForm ? "Cancel" : "+ Set Budget"}
          </PrimaryButton>
        </div>

        {showBudgetForm && (
          <form
            onSubmit={handleSetBudget}
            className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-blue-100 bg-blue-50/30 p-5 md:grid-cols-3"
          >
            <FilterSelect
              label="Classroom"
              value={budgetForm.classRoomId}
              onChange={(v) => setBudgetForm({ ...budgetForm, classRoomId: v })}
            >
              <option value="">Select classroom…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FilterSelect>
            <FilterInput
              label="Allocated Amount ($)"
              type="number"
              value={budgetForm.allocatedAmount}
              onChange={(v) =>
                setBudgetForm({ ...budgetForm, allocatedAmount: v })
              }
            />
            <FilterInput
              label="Notes"
              type="text"
              value={budgetForm.notes}
              onChange={(v) => setBudgetForm({ ...budgetForm, notes: v })}
            />
            <div className="flex items-end">
              <SaveButton saving={saving} label="Save Budget" />
            </div>
          </form>
        )}
      </Card>

      {loading ? (
        <Loading />
      ) : budgets.length === 0 ? (
        <EmptyCard
          icon="💰"
          title="No budgets set"
          msg="No budgets for this month. Set one using the button above."
        />
      ) : (
        budgets.map((b) => {
          const pct =
            b.allocatedAmount > 0
              ? Math.min(100, Math.round((b.spent / b.allocatedAmount) * 100))
              : 0;
          const barColor =
            pct > 90
              ? "bg-red-500"
              : pct > 70
                ? "bg-amber-500"
                : "bg-emerald-500";

          return (
            <Card key={b.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg">
                    🏫
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">
                      {b.classRoom?.name || "Classroom"}
                    </div>
                    <div className="text-xs text-gray-500">{b.month}</div>
                  </div>
                </div>
                <PrimaryButton
                  size="sm"
                  onClick={() =>
                    setExpenseForm({
                      budgetId: b.id,
                      description: "",
                      amount: "",
                      date: today(),
                      category: "Other",
                    })
                  }
                >
                  + Add Expense
                </PrimaryButton>
              </div>

              {/* Budget Overview */}
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                <KpiCard
                  label="Allocated"
                  value={`$${b.allocatedAmount.toFixed(2)}`}
                  color="sky"
                />
                <KpiCard
                  label="Spent"
                  value={`$${(b.spent || 0).toFixed(2)}`}
                  color={pct > 90 ? "red" : "amber"}
                />
                <KpiCard
                  label="Remaining"
                  value={`$${(b.remaining || 0).toFixed(2)}`}
                  color="emerald"
                />
                <div className="flex flex-col justify-center rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-400">
                    Usage
                  </div>
                  <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-3 rounded-full transition-all ${barColor}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-1.5 text-lg font-extrabold text-gray-900">
                    {pct}%
                  </div>
                </div>
              </div>

              {expenseForm && expenseForm.budgetId === b.id && (
                <form
                  onSubmit={handleAddExpense}
                  className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-blue-100 bg-blue-50/30 p-4 md:grid-cols-3"
                >
                  <FilterInput
                    label="Description"
                    type="text"
                    value={expenseForm.description}
                    onChange={(v) =>
                      setExpenseForm({ ...expenseForm, description: v })
                    }
                  />
                  <FilterInput
                    label="Amount ($)"
                    type="number"
                    value={expenseForm.amount}
                    onChange={(v) =>
                      setExpenseForm({ ...expenseForm, amount: v })
                    }
                  />
                  <FilterInput
                    label="Date"
                    type="date"
                    value={expenseForm.date}
                    onChange={(v) =>
                      setExpenseForm({ ...expenseForm, date: v })
                    }
                  />
                  <FilterSelect
                    label="Category"
                    value={expenseForm.category}
                    onChange={(v) =>
                      setExpenseForm({ ...expenseForm, category: v })
                    }
                  >
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </FilterSelect>
                  <div className="flex items-end gap-2">
                    <SaveButton saving={saving} label="Add" />
                    <button
                      type="button"
                      onClick={() => setExpenseForm(null)}
                      className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {b.expenses && b.expenses.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50/80 text-left text-xs font-bold uppercase tracking-wider text-gray-400">
                        <th className="px-4 py-3">Description</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.expenses.map((exp) => (
                        <tr
                          key={exp.id}
                          className="border-b border-gray-50 transition hover:bg-blue-50/30"
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {exp.description}
                          </td>
                          <td className="px-4 py-3 font-bold text-gray-900">
                            ${exp.amount.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {fmtDate(exp.date)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                              {exp.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDeleteExpense(b.id, exp.id)}
                              className="text-xs font-semibold text-red-500 hover:text-red-700 transition"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
