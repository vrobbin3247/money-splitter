import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

export default function Dashboard() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchExpenses() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Fetch expenses where the user is the buyer
        const { data: buyerExpenses, error: buyerError } = await supabase
          .from("expenses")
          .select("*")
          .eq("buyer_id", user.id)
          .order("created_at", { ascending: false });

        if (buyerError) throw buyerError;

        // Fetch expenses where the user is a participant
        const { data: participantExpenses, error: participantError } =
          await supabase
            .from("expense_participants")
            .select("expenses(*)")
            .eq("participant_id", user.id)
            .order("created_at", { ascending: false });

        if (participantError) throw participantError;

        // Flatten participantExpenses into expenses
        const participantExpenseList =
          participantExpenses?.map((p) => p.expenses) || [];

        // Merge and dedupe by expense ID
        const combined = [...(buyerExpenses || []), ...participantExpenseList];
        const uniqueExpenses = Object.values(
          combined.reduce((acc, exp) => {
            acc[exp.id] = exp;
            return acc;
          }, {} as Record<string, any>)
        );

        // Sort by created_at descending
        uniqueExpenses.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        setExpenses(uniqueExpenses);
      } catch (error: any) {
        console.error("Error fetching expenses:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchExpenses();
  }, [user]);

  if (loading) {
    return <p className="text-gray-600 text-sm">Loading expenses...</p>;
  }

  if (expenses.length === 0) {
    return <p className="text-gray-600 text-sm">No expenses yet.</p>;
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-4">
      {expenses.map((expense) => (
        <div
          key={expense.id}
          className="rounded-xl border border-gray-200 p-4 shadow-sm bg-white hover:shadow-md transition"
        >
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-lg">{expense.title}</h3>
            </div>
            <div className="text-right">
              <p className="text-green-600 font-bold text-lg">
                ₹{expense.amount}
              </p>
              <p className="text-xs text-gray-500">
                {new Date(expense.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
