import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { FaRupeeSign } from "react-icons/fa";
import ExpenseCard from "../dashboard_components/ExpenseCard";
import ExpenseModal from "../dashboard_components/ExpenseModal";

interface Expense {
  id: string;
  title: string;
  amount: number;
  buyer_id: string;
  created_at: string;
  total_participants?: number;
  buyer_name?: string;
  participants?: Participant[];
  category?: string;
  [key: string]: any;
}

interface Participant {
  id?: string;
  participant_id: string;
  name: string;
  settlement_status?: boolean;
}

export default function Dashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const calculateSplitAmount = (amount: number, totalParticipants: number) => {
    return Number(amount / totalParticipants);
  };

  const fetchExpenses = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch expenses where user is the buyer
      const { data: buyerExpenses, error: buyerError } = await supabase
        .from("expenses")
        .select("*")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (buyerError) throw buyerError;

      // Fetch expenses where user is a participant
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

      // Enhanced: Fetch participant data for each expense
      const expensesWithParticipants = await Promise.all(
        uniqueExpenses.map(async (expense) => {
          try {
            // Get buyer name
            let buyerName = "Unknown";
            if (expense.buyer_id) {
              const { data: profileData } = await supabase
                .from("profiles")
                .select("name")
                .eq("id", expense.buyer_id)
                .single();
              buyerName = profileData?.name || "Unknown";
            }

            // Get participants WITH settlement_status
            const { data: participantsData } = await supabase
              .from("expense_participants")
              .select(
                `
                participant_id,
                settlement_status,
                profiles!inner(name)
              `
              )
              .eq("expense_id", expense.id);

            // Also fetch settlements to double-check status
            const { data: settlementsData } = await supabase
              .from("settlements")
              .select("*")
              .eq("expense_id", expense.id);

            const participants: Participant[] =
              participantsData?.map((p: any) => {
                // Same settlement logic as in fetchExpenseDetails
                const isSettled =
                  settlementsData?.some(
                    (s: any) => s.payer_id === p.participant_id && s.is_settled
                  ) || p.settlement_status;

                return {
                  participant_id: p.participant_id,
                  name: p.profiles?.name || "Unknown",
                  settlement_status: isSettled,
                };
              }) || [];

            const participantNames = participants.map((p) => p.name);
            const uniqueParticipants = new Set([
              buyerName,
              ...participantNames,
            ]);
            const totalParticipants = uniqueParticipants.size;

            return {
              ...expense,
              buyer_name: buyerName,
              participants,
              total_participants: totalParticipants,
            };
          } catch (error) {
            console.error(
              `Error fetching data for expense ${expense.id}:`,
              error
            );
            return {
              ...expense,
              buyer_name: "Unknown",
              participants: [],
              total_participants: 1,
            };
          }
        })
      );

      expensesWithParticipants.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setExpenses(expensesWithParticipants);
    } catch (error: any) {
      console.error("Error fetching expenses:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [user]);

  // Enhanced settlement function with user perspective
  const getSettlementStatus = (expense: Expense, userId?: string) => {
    if (!expense.total_participants || expense.total_participants <= 1) {
      return {
        isFullySettled: true,
        settledCount: 0,
        totalCount: 0,
        progress: 100,
        userPerspective: "complete",
      };
    }

    const isUserBuyer = expense.buyer_id === userId;
    const totalCount = expense.total_participants;
    const settledCount = expense.participants
      ? expense.participants.filter((p: Participant) => p.settlement_status)
          .length
      : 0;

    if (isUserBuyer) {
      // Buyer perspective: Show overall settlement progress
      const isFullySettled = settledCount === totalCount;
      const progress = (settledCount / totalCount) * 100;
      return {
        isFullySettled,
        settledCount,
        totalCount,
        progress,
        userPerspective: "buyer",
        displayText: `${settledCount}/${totalCount} paid`,
      };
    } else {
      // Participant perspective: Only care about their own settlement
      const userParticipant = expense.participants?.find(
        (p: Participant) => p.participant_id === userId
      );
      const isUserSettled = userParticipant?.settlement_status || false;
      return {
        isFullySettled: isUserSettled,
        settledCount: isUserSettled ? 1 : 0,
        totalCount: 1,
        progress: isUserSettled ? 100 : 0,
        userPerspective: "participant",
        displayText: isUserSettled ? "Paid" : "Pending",
      };
    }
  };

  const handleExpenseClick = (expenseId: string) => {
    setSelectedExpenseId(expenseId);
  };

  const handleModalClose = () => {
    setSelectedExpenseId(null);
  };

  const handleExpenseUpdate = () => {
    // Refresh expenses data when an expense is updated
    fetchExpenses();
  };

  if (loading) {
    return (
      <div className="h-screen p-6 animate-pulse">
        <div className="flex justify-between mb-8">
          <div className="h-8 bg-gray-200 rounded w-32"></div>
          <div className="h-8 bg-gray-200 rounded w-8"></div>
        </div>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-xl"></div>
          ))}
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
      {/* Expenses List */}
      <div className="space-y-3">
        {expenses.map((expense) => (
          <ExpenseCard
            key={expense.id}
            expense={expense}
            user={user}
            selectedExpenseId={selectedExpenseId}
            onExpenseClick={handleExpenseClick}
            calculateSplitAmount={calculateSplitAmount}
            getSettlementStatus={getSettlementStatus}
          />
        ))}
      </div>

      {/* Expense Modal */}
      <ExpenseModal
        selectedExpenseId={selectedExpenseId}
        onClose={handleModalClose}
        onExpenseUpdate={handleExpenseUpdate}
      />
    </div>
  );
}
