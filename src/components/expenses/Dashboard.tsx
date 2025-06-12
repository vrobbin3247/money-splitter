import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { FaRupeeSign } from "react-icons/fa";
import { FiUsers, FiX, FiUser, FiCalendar } from "react-icons/fi";
import Modal from "../ui/Modal";

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

  // Your existing useEffect for fetching expenses
  useEffect(() => {
    async function fetchExpenses() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data: buyerExpenses, error: buyerError } = await supabase
          .from("expenses")
          .select("*")
          .eq("buyer_id", user.id)
          .order("created_at", { ascending: false });

        if (buyerError) throw buyerError;

        const { data: participantExpenses, error: participantError } =
          await supabase
            .from("expense_participants")
            .select("expenses(*)")
            .eq("participant_id", user.id)
            .order("created_at", { ascending: false });

        if (participantError) throw participantError;

        type ExpenseParticipant = { expenses: Expense[] };
        const participantExpenseList: Expense[] = (
          participantExpenses as ExpenseParticipant[]
        ).flatMap((p) => p.expenses ?? []);

        const combined = [...(buyerExpenses || []), ...participantExpenseList];
        const uniqueExpenses: Expense[] = Object.values(
          combined.reduce((acc, exp) => {
            acc[exp.id] = exp;
            return acc;
          }, {} as Record<string, Expense>)
        );

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

  // Your existing useEffect for fetching expense details
  useEffect(() => {
    async function fetchExpenseDetails() {
      if (!selectedExpenseId) {
        setSelectedExpenseDetails(null);
        return;
      }

      setDetailsLoading(true);
      try {
        const { data: expenseData, error: expenseError } = await supabase
          .from("expenses")
          .select("*")
          .eq("id", selectedExpenseId)
          .single();

        if (expenseError) throw expenseError;

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

        const participantsWithNames: Participant[] =
          participantsData?.map((p: any) => ({
            participant_id: p.participant_id,
            name: p.profiles?.name || "Unknown",
          })) || [];

        const participantNames = participantsWithNames.map((p) => p.name);
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

  // Helper function to format dates
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading expenses...</p>
        </div>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="text-center py-20">
        <FaRupeeSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          No expenses yet
        </h3>
        <p className="text-gray-600 mb-6">Start by adding your first expense</p>
      </div>
    );
  }

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl text-center font-bold text-gray-900 mb-2">
          Your Expenses
        </h2>
        {/* <p className="text-gray-600">{expenses.length} total expenses</p> */}
      </div>

      {/* Expenses List */}
      <div className="space-y-4">
        {expenses.map((expense) => {
          const isUserBuyer = expense.buyer_id === user?.id;

          return (
            <div
              key={expense.id}
              className={`bg-white rounded-2xl py-2.5 px-6 shadow-sm border border-gray-100 active:scale-[0.98] transition-all cursor-pointer ${
                selectedExpenseId === expense.id
                  ? "ring-2 ring-blue-500 border-blue-200"
                  : "hover:shadow-md"
              }`}
              onClick={() => setSelectedExpenseId(expense.id)}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-lg mb-2 truncate">
                    {expense.title}
                  </h3>
                  <div className="flex items-center gap-2">
                    {isUserBuyer ? (
                      <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                        You paid
                      </span>
                    ) : (
                      <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
                        Split expense
                      </span>
                    )}
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <FiCalendar className="w-3 h-3" />
                      {formatDate(expense.created_at)}
                    </span>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className="text-2xl font-bold text-gray-900">
                    ₹{expense.amount.toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-600 font-medium mt-1">
                    View split
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile-Optimized Details Modal */}
      <Modal
        isOpen={!!selectedExpenseId}
        onClose={() => setSelectedExpenseId(null)}
      >
        {selectedExpenseDetails && !detailsLoading ? (
          <>
            {/* Custom Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center rounded-t-3xl">
              <h2 className="text-xl font-semibold text-gray-900">
                Expense Details
              </h2>
              <button
                onClick={() => setSelectedExpenseId(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <FiX className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-6">
              {/* Expense Overview */}
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {selectedExpenseDetails.title}
                </h3>
                <div className="text-4xl font-bold text-green-600 mb-2">
                  ₹{selectedExpenseDetails.amount.toLocaleString()}
                </div>
                <div className="text-gray-600 flex items-center justify-center gap-1">
                  <FiCalendar className="w-4 h-4" />
                  {formatDate(selectedExpenseDetails.created_at)}
                </div>
              </div>

              {/* Your Share & People Count */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-2xl p-4 text-center">
                  <FaRupeeSign className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                  <div className="text-3xl font-bold text-blue-600">
                    {(
                      selectedExpenseDetails.amount /
                      selectedExpenseDetails.total_participants
                    ).toFixed(0)}
                  </div>
                  <div className="text-sm text-blue-700">Your Share</div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 text-center">
                  <FiUsers className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                  <div className="text-3xl font-bold text-gray-600">
                    {selectedExpenseDetails.total_participants}
                  </div>
                  <div className="text-sm text-gray-700">People</div>
                </div>
              </div>

              {/* Who Paid */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 text-lg">Paid by</h4>
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-2xl">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <FiUser className="w-6 h-6 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-green-900">
                      {selectedExpenseDetails.buyer_name}
                    </div>
                    <div className="text-sm text-green-700">
                      Paid ₹{selectedExpenseDetails.amount.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Split Details */}
              <div className="space-y-3">
                <h4 className="font-semibold text-gray-900 text-lg">
                  Split between
                </h4>
                <div className="space-y-3">
                  {Array.from(
                    new Set([
                      selectedExpenseDetails.buyer_name,
                      ...selectedExpenseDetails.participants.map((p) => p.name),
                    ])
                  ).map((name, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                          <FiUser className="w-5 h-5 text-gray-600" />
                        </div>
                        <span className="font-medium text-gray-900">
                          {name}
                        </span>
                      </div>
                      <span className="font-semibold text-gray-900">
                        ₹
                        {(
                          selectedExpenseDetails.amount /
                          selectedExpenseDetails.total_participants
                        ).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedExpenseId(null)}
                className="w-full bg-gray-100 text-gray-700 py-4 rounded-2xl font-semibold text-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin  rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading details...</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
