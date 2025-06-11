import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

interface Expense {
  id: string;
  title: string;
  amount: number;
  buyer_id: string;
  created_at: string;
  [key: string]: any;
}

interface Participant {
  participant_id: string;
  name: string;
}

interface ExpenseDetails {
  id: string;
  title: string;
  amount: number;
  buyer_id: string;
  buyer_name: string;
  participants: Participant[];
  total_participants: number;
  created_at: string;
}

export default function Dashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(
    null
  );
  const [selectedExpenseDetails, setSelectedExpenseDetails] =
    useState<ExpenseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
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
        type ExpenseParticipant = {
          expenses: Expense[];
        };

        const participantExpenseList: Expense[] = (
          participantExpenses as ExpenseParticipant[]
        ).flatMap((p) => p.expenses ?? []);

        // Merge and dedupe by expense ID
        const combined = [...(buyerExpenses || []), ...participantExpenseList];
        const uniqueExpenses: Expense[] = Object.values(
          combined.reduce((acc, exp) => {
            acc[exp.id] = exp;
            return acc;
          }, {} as Record<string, Expense>)
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

  useEffect(() => {
    async function fetchExpenseDetails() {
      if (!selectedExpenseId) {
        setSelectedExpenseDetails(null);
        return;
      }

      setDetailsLoading(true);
      try {
        // Fetch expense data
        const { data: expenseData, error: expenseError } = await supabase
          .from("expenses")
          .select("*")
          .eq("id", selectedExpenseId)
          .single();

        if (expenseError) throw expenseError;

        // Fetch the buyer's profile
        let buyerName: string = "Unknown";
        if (expenseData?.buyer_id) {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", expenseData.buyer_id)
            .single();

          if (profileError) {
            console.error("Error fetching buyer profile:", profileError);
          } else {
            buyerName = profileData?.name || "Unknown";
          }
        }

        // Fetch all participants with their names
        const { data: participantsData, error: participantsError } =
          await supabase
            .from("expense_participants")
            .select(
              `
              participant_id,
              profiles!inner(name)
            `
            )
            .eq("expense_id", selectedExpenseId);

        if (participantsError) throw participantsError;

        // Transform participants data to include names
        const participantsWithNames: Participant[] =
          participantsData?.map((p: any) => ({
            participant_id: p.participant_id,
            name: p.profiles?.name || "Unknown",
          })) || [];

        // Calculate total participants correctly
        const participantNames = participantsWithNames.map((p) => p.name);
        // Use Set to get unique participants (handles case where buyer is also in participants table)
        const uniqueParticipants = new Set([buyerName, ...participantNames]);
        const totalParticipants = uniqueParticipants.size;

        setSelectedExpenseDetails({
          ...expenseData,
          buyer_name: buyerName,
          participants: participantsWithNames,
          total_participants: totalParticipants,
        });
      } catch (error: any) {
        console.error("Error fetching expense details:", error);
      } finally {
        setDetailsLoading(false);
      }
    }

    fetchExpenseDetails();
  }, [selectedExpenseId]);

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
          className="rounded-xl border border-gray-200 p-4 shadow-sm bg-white hover:shadow-md transition cursor-pointer"
          onClick={() => setSelectedExpenseId(expense.id)}
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

      {selectedExpenseDetails && (
        <div className="mt-4 p-4 border rounded-xl bg-white shadow-md">
          {detailsLoading ? (
            <p className="text-gray-600">Loading expense details...</p>
          ) : (
            <>
              <h3 className="font-semibold text-lg mb-3">Expense Details</h3>
              <div className="space-y-2">
                <p>
                  <span className="font-medium">Title:</span>{" "}
                  {selectedExpenseDetails.title}
                </p>
                <p>
                  <span className="font-medium">Amount:</span> ₹
                  {selectedExpenseDetails.amount}
                </p>
                <p>
                  <span className="font-medium">Buyer:</span>{" "}
                  {selectedExpenseDetails.buyer_name}
                </p>
                <p>
                  <span className="font-medium">Participants:</span>{" "}
                  {(() => {
                    // Get all participant names from expense_participants table
                    const participantNames =
                      selectedExpenseDetails.participants.map((p) => p.name);
                    // Create a set to avoid duplicates, then add buyer
                    const allParticipantsSet = new Set([
                      selectedExpenseDetails.buyer_name,
                      ...participantNames,
                    ]);
                    return Array.from(allParticipantsSet).join(", ");
                  })()}
                </p>
                <p>
                  <span className="font-medium">Total People:</span>{" "}
                  {selectedExpenseDetails.total_participants}
                </p>
                <p className="text-lg font-semibold text-blue-600">
                  <span className="font-medium">Your Share:</span> ₹
                  {(
                    selectedExpenseDetails.amount /
                    selectedExpenseDetails.total_participants
                  ).toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => setSelectedExpenseId(null)}
                className="mt-3 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition"
              >
                Close Details
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
