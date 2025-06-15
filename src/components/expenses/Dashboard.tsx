import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { FaRupeeSign } from "react-icons/fa";
import {
  FiUsers,
  FiX,
  FiUser,
  FiCalendar,
  FiCheck,
  FiClock,
} from "react-icons/fi";
import { categories } from "../../components/constants/categories";
import Modal from "../ui/Modal";

interface Expense {
  id: string;
  title: string;
  amount: number;
  buyer_id: string;
  created_at: string;
  total_participants?: number;
  buyer_name?: string;
  participants?: Participant[];
  [key: string]: any;
}

interface Settlement {
  id: string;
  expense_id: string;
  payer_id: string;
  payee_id: string;
  amount: number;
  is_settled: boolean;
}

interface Participant {
  id?: string; // expense_participants table id
  participant_id: string; // references profiles.id
  name: string;
  settlement_status?: boolean; // defaults to false in DB
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

// New interface for settlement feedback
interface SettlementFeedback {
  show: boolean;
  type: "success" | "error";
  message: string;
  participantName?: string;
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
  const [settlements, setSettlements] = useState<Settlement[]>([]);

  // New state for settlement feedback and loading
  const [settlementFeedback, setSettlementFeedback] =
    useState<SettlementFeedback>({
      show: false,
      type: "success",
      message: "",
    });
  const [settlingParticipants, setSettlingParticipants] = useState<Set<string>>(
    new Set()
  );

  const calculateSplitAmount = (amount: number, totalParticipants: number) => {
    return Number(amount / totalParticipants);
  };

  // Enhanced settlement function with better feedback
  const markAsSettled = async (participantId: string, expenseId: string) => {
    if (!user || !selectedExpenseDetails) return;

    // Add participant to settling state
    setSettlingParticipants((prev) => new Set([...prev, participantId]));

    try {
      // Verify the expense exists and get buyer info
      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .select("buyer_id")
        .eq("id", expenseId)
        .single();

      if (expenseError) throw expenseError;

      // Check if user is participant in this expense
      const { data: participantCheck } = await supabase
        .from("expense_participants")
        .select("participant_id")
        .eq("expense_id", expenseId)
        .eq("participant_id", user.id)
        .single();

      // User must be either buyer or participant
      const isBuyer = expense.buyer_id === user.id;
      const isParticipant = !!participantCheck;

      if (!isBuyer && !isParticipant) {
        throw new Error("You are not authorized to settle this expense");
      }

      // User can only settle themselves unless they're the buyer
      if (!isBuyer && participantId !== user.id) {
        throw new Error("You can only settle your own share");
      }

      // Update participant status
      const { error: updateError } = await supabase
        .from("expense_participants")
        .update({ settlement_status: true })
        .eq("expense_id", expenseId)
        .eq("participant_id", participantId);

      if (updateError) throw updateError;

      // Create settlement record (payer → payee)
      const { data: settlement, error: settlementError } = await supabase
        .from("settlements")
        .insert([
          {
            expense_id: expenseId,
            payer_id: participantId,
            payee_id: expense.buyer_id,
            amount: calculateSplitAmount(
              selectedExpenseDetails.amount,
              selectedExpenseDetails.total_participants
            ),
            is_settled: true,
          },
        ])
        .select();

      if (settlementError) throw settlementError;

      // Update local state
      if (settlement) {
        setSettlements([...settlements, ...settlement]);
        setSelectedExpenseDetails({
          ...selectedExpenseDetails,
          participants: selectedExpenseDetails.participants.map((p) =>
            p.participant_id === participantId
              ? { ...p, settlement_status: true }
              : p
          ),
        });

        // Show success feedback
        const participantName =
          selectedExpenseDetails.participants.find(
            (p) => p.participant_id === participantId
          )?.name || "Participant";

        setSettlementFeedback({
          show: true,
          type: "success",
          message: `${participantName}'s payment has been marked as settled!`,
          participantName,
        });

        // Auto-hide feedback after 3 seconds
        setTimeout(() => {
          setSettlementFeedback((prev) => ({ ...prev, show: false }));
        }, 3000);
      }
    } catch (error: any) {
      console.error("Settlement error:", error);

      // Show error feedback
      setSettlementFeedback({
        show: true,
        type: "error",
        message: error.message || "Failed to settle payment. Please try again.",
      });

      // Auto-hide feedback after 4 seconds
      setTimeout(() => {
        setSettlementFeedback((prev) => ({ ...prev, show: false }));
      }, 4000);
    } finally {
      // Remove participant from settling state
      setSettlingParticipants((prev) => {
        const newSet = new Set(prev);
        newSet.delete(participantId);
        return newSet;
      });
    }
  };

  useEffect(() => {
    async function fetchExpenses() {
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

              // Get participants WITH settlement_status - THIS IS THE FIX
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

              // Also fetch settlements to double-check status (same logic as details)
              const { data: settlementsData } = await supabase
                .from("settlements")
                .select("*")
                .eq("expense_id", expense.id);

              const participants: Participant[] =
                participantsData?.map((p: any) => {
                  // Same settlement logic as in fetchExpenseDetails
                  const isSettled =
                    settlementsData?.some(
                      (s: any) =>
                        s.payer_id === p.participant_id && s.is_settled
                    ) || p.settlement_status;

                  return {
                    participant_id: p.participant_id,
                    name: p.profiles?.name || "Unknown",
                    settlement_status: isSettled, // ✅ Now included!
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
        // Fetch the basic expense data
        const { data: expenseData, error: expenseError } = await supabase
          .from("expenses")
          .select("*")
          .eq("id", selectedExpenseId)
          .single();

        if (expenseError) throw expenseError;

        // Fetch buyer's name
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

        // Fetch participants with their names
        const { data: participantsData, error: participantsError } =
          await supabase
            .from("expense_participants")
            .select(
              `
            participant_id,
            settlement_status,
            profiles!inner(name)
          `
            )
            .eq("expense_id", selectedExpenseId);

        if (participantsError) throw participantsError;

        // Fetch settlement records for this expense
        const { data: settlementsData, error: settlementsError } =
          await supabase
            .from("settlements")
            .select("*")
            .eq("expense_id", selectedExpenseId);

        if (settlementsError)
          console.error("Error fetching settlements:", settlementsError);

        setSettlements(settlementsData || []);

        // Process participants with settlement status
        const participantsWithStatus: Participant[] =
          participantsData?.map((p: any) => {
            const isSettled =
              settlementsData?.some(
                (s: Settlement) =>
                  s.payer_id === p.participant_id && s.is_settled
              ) || p.settlement_status;

            return {
              participant_id: p.participant_id,
              name: p.profiles?.name || "Unknown",
              settlement_status: isSettled,
            };
          }) || [];

        // Calculate unique participants count
        const participantNames = participantsWithStatus.map((p) => p.name);
        const uniqueParticipants = new Set([buyerName, ...participantNames]);
        const totalParticipants = uniqueParticipants.size;

        // Update state with all the fetched data
        setSelectedExpenseDetails({
          ...expenseData,
          buyer_name: buyerName,
          participants: participantsWithStatus,
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

  interface ModalHeaderProps {
    expense: ExpenseDetails;
    onClose: () => void;
  }

  const ModalHeader = ({ expense, onClose }: ModalHeaderProps) => (
    <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-6 py-4 rounded-t-3xl">
      <div className="flex justify-between items-start">
        <div className="flex-1 pr-4">
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            {expense.title}
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FiCalendar className="w-4 h-4" />
            {formatDate(expense.created_at)}
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors shrink-0"
          aria-label="Close modal"
        >
          <FiX className="w-5 h-5 text-gray-500" />
        </button>
      </div>
    </div>
  );

  interface AmountHeroProps {
    expense: ExpenseDetails;
  }

  const AmountHero = ({ expense }: AmountHeroProps) => {
    const shareAmount = (expense.amount / expense.total_participants).toFixed(
      0
    );

    return (
      <div className="text-center bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-6 border border-green-100">
        <div className="text-sm font-medium text-green-700 mb-2">
          Total Amount
        </div>
        <div className="text-5xl font-bold text-green-600 mb-4">
          ₹
          <span>
            {Number.isInteger(expense.amount)
              ? expense.amount.toLocaleString()
              : expense.amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
          </span>
        </div>
        <div className="inline-flex items-center gap-2 bg-white/80 rounded-full px-4 py-2 text-green-800">
          <span className="text-sm">Your share:</span>
          <span className="font-bold text-lg">₹{shareAmount}</span>
        </div>
      </div>
    );
  };

  interface QuickStatsProps {
    expense: ExpenseDetails;
  }

  const QuickStats = ({ expense }: QuickStatsProps) => (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <FiUsers className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {expense.total_participants}
            </div>
            <div className="text-xs text-blue-700 font-medium">
              People involved
            </div>
          </div>
        </div>
      </div>

      <div className="bg-purple-50 rounded-2xl p-4 border border-purple-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
            <FaRupeeSign className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {(expense.amount / expense.total_participants).toFixed(0)}
            </div>
            <div className="text-xs text-purple-700 font-medium">
              Per person
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  interface PaymentInfoProps {
    expense: ExpenseDetails;
  }

  const PaymentInfo = ({ expense }: PaymentInfoProps) => (
    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
          <FiUser className="w-4 h-4 text-green-600" />
        </div>
        <h4 className="font-semibold text-gray-900">Payment Details</h4>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center border-2 border-green-200">
              <span className="text-lg font-bold text-green-700">
                {expense.buyer_name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="font-semibold text-gray-900">
                {expense.buyer_name}
              </div>
              <div className="text-sm text-gray-500">Paid the full amount</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-green-600">
              ₹{expense.amount.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Total paid</div>
          </div>
        </div>
      </div>
    </div>
  );

  // Enhanced Settlement Feedback Component
  const SettlementFeedbackToast = ({
    settlementFeedback,
  }: {
    settlementFeedback: {
      show: boolean;
      type: "success" | "error";
      message: string;
    };
  }) => {
    if (!settlementFeedback.show) return null;

    return (
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-top-4 duration-300">
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
            settlementFeedback.type === "success"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          <div
            className={`w-6 h-6 rounded-full flex items-center justify-center ${
              settlementFeedback.type === "success"
                ? "bg-green-100"
                : "bg-red-100"
            }`}
          >
            {settlementFeedback.type === "success" ? (
              <FiCheck className="w-4 h-4" />
            ) : (
              <FiX className="w-4 h-4" />
            )}
          </div>
          <span className="font-medium text-sm">
            {settlementFeedback.message}
          </span>
        </div>
      </div>
    );
  };

  interface SplitBreakdownProps {
    expense: ExpenseDetails;
  }

  const SplitBreakdown = ({ expense }: SplitBreakdownProps) => {
    const { user } = useAuth();
    const isCurrentUserBuyer = expense.buyer_id === user?.id;

    // Create a map to ensure unique participants
    const participantMap = new Map<
      string,
      {
        id: string;
        name: string;
        isBuyer: boolean;
        settlement_status: boolean;
        isCurrentUser: boolean;
      }
    >();

    // Add buyer first
    participantMap.set(expense.buyer_id, {
      id: expense.buyer_id,
      name: expense.buyer_name,
      isBuyer: true,
      settlement_status: true, // Buyer is always considered settled
      isCurrentUser: expense.buyer_id === user?.id,
    });

    // Add other participants
    expense.participants.forEach((p) => {
      if (!participantMap.has(p.participant_id)) {
        participantMap.set(p.participant_id, {
          id: p.participant_id,
          name: p.name,
          isBuyer: false,
          settlement_status: p.settlement_status || false,
          isCurrentUser: p.participant_id === user?.id,
        });
      }
    });

    const uniqueParticipants = Array.from(participantMap.values());
    const shareAmount = calculateSplitAmount(
      expense.amount,
      expense.total_participants
    ).toFixed(0);

    return (
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 bg-purple-100 rounded flex items-center justify-center">
            <FiUsers className="w-4 h-4 text-purple-600" />
          </div>
          <h4 className="font-semibold text-gray-900">Split Breakdown</h4>
        </div>
        <SettlementFeedbackToast settlementFeedback={settlementFeedback} />
        <div className="space-y-2">
          {uniqueParticipants.map((participant) => {
            const showSettleButton =
              (isCurrentUserBuyer && !participant.isCurrentUser) || // Buyer can settle others
              (participant.isCurrentUser && !participant.isBuyer); // Participant can settle themselves

            const isSettling = settlingParticipants.has(participant.id);

            return (
              <div
                key={participant.id}
                className={`flex items-center justify-between py-3 px-3 rounded-2xl border transition-all duration-300 ${
                  participant.settlement_status
                    ? "bg-green-50 border-gray-100"
                    : "bg-white border-gray-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-md flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-600">
                      {participant.name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900 truncate">
                      {participant.name}
                      {participant.isCurrentUser && (
                        <span className="ml-1 text-xs text-gray-500">
                          (You)
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-gray-900 mb-1">
                    ₹{shareAmount}
                  </div>

                  {!participant.settlement_status && showSettleButton && (
                    <button
                      onClick={async () => {
                        if (participant.isCurrentUser || isCurrentUserBuyer) {
                          try {
                            await markAsSettled(participant.id, expense.id);
                            setSettlementFeedback({
                              show: true,
                              type: "success",
                              message: "Marked as paid",
                            });
                          } catch (error) {
                            setSettlementFeedback({
                              show: true,
                              type: "error",
                              message: "Failed to mark as paid",
                            });
                          } finally {
                            setTimeout(() => {
                              setSettlementFeedback((prev) => ({
                                ...prev,
                                show: false,
                              }));
                            }, 3000); // auto-hide
                          }
                        } else {
                          alert("You can only settle your own share");
                        }
                      }}
                      disabled={isSettling}
                      className={`text-xs px-2 py-1 rounded font-medium transition-all duration-200 ${
                        isSettling
                          ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700 active:scale-95"
                      }`}
                    >
                      {isSettling ? (
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                          <span>Settling...</span>
                        </div>
                      ) : (
                        "Mark as Paid"
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  interface ActionButtonsProps {
    onClose: () => void;
  }

  const SettlementSummary = ({ expense }: { expense: ExpenseDetails }) => {
    const totalParticipants = expense.total_participants;
    const settledCount = expense.participants.filter(
      (p) => p.settlement_status
    ).length;
    const settlementProgress = (settledCount / (totalParticipants - 1)) * 100;
    const isFullySettled = settledCount === totalParticipants - 1;

    return (
      <div
        className={`rounded-2xl p-5 border transition-all duration-300 ${
          isFullySettled
            ? "bg-green-50 border-green-200"
            : "bg-gray-50 border-gray-200"
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-lg flex items-center justify-center ${
                isFullySettled ? "bg-green-100" : "bg-gray-100"
              }`}
            >
              {isFullySettled ? (
                <FiCheck className="w-4 h-4 text-green-600" />
              ) : (
                <FiClock className="w-4 h-4 text-gray-600" />
              )}
            </div>
            <h4
              className={`font-semibold ${
                isFullySettled ? "text-green-900" : "text-gray-900"
              }`}
            >
              Settlement Progress
            </h4>
          </div>
          <span
            className={`text-sm font-medium ${
              isFullySettled ? "text-green-700" : "text-gray-600"
            }`}
          >
            {settledCount}/{totalParticipants - 1} settled
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              isFullySettled ? "bg-green-500" : "bg-blue-500"
            }`}
            style={{ width: `${settlementProgress}%` }}
          ></div>
        </div>

        {isFullySettled && (
          <div className="text-sm text-green-700 font-medium mt-2">
            🎉 All payments settled!
          </div>
        )}
      </div>
    );
  };

  const ActionButtons: React.FC<ActionButtonsProps> = ({ onClose }) => (
    <div className="flex gap-3 pt-2">
      <button
        onClick={onClose}
        className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-2xl font-semibold hover:bg-gray-200 transition-all duration-200 active:scale-98"
      >
        Close
      </button>
      <button className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-semibold hover:bg-blue-700 transition-all duration-200 active:scale-98 shadow-lg shadow-blue-600/25">
        Share Details
      </button>
    </div>
  );

  const LoadingState = () => (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4">
          <div className="w-full h-full border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
        <p className="text-gray-600 font-medium">Loading expense details...</p>
      </div>
    </div>
  );

  const getCategoryIcon = (categoryValue: string) => {
    const found = categories.find((cat) => cat.value === categoryValue);
    return found?.icon || null;
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

  // Enhanced settlement function with user perspective
  const getSettlementStatus = (expense, userId) => {
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
    const totalCount = expense.total_participants - 1; // Exclude buyer
    const settledCount = expense.participants
      ? expense.participants.filter((p) => p.settlement_status).length
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
        (p) => p.participant_id === userId
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

  return (
    <div className="pb-6">
      {/* Expenses List */}
      <div className="space-y-3">
        {" "}
        {/* Reduced spacing */}
        {expenses.map((expense) => {
          const isUserBuyer = expense.buyer_id === user?.id;
          const settlement = getSettlementStatus(expense, user?.id);
          const splitAmount = expense.total_participants
            ? calculateSplitAmount(expense.amount, expense.total_participants)
            : 0;

          return (
            <div
              key={expense.id}
              className={`relative shadow-sm bg-white rounded-2xl py-2.5 p-4 border  active:scale-[0.98] transition-all cursor-pointer group
                ${
                  settlement.isFullySettled
                    ? "border-l border-t border-r-4 border-r-green-400 border-b border-gray-100"
                    : "border border-gray-100 hover:border-gray-300"
                }
          ${
            selectedExpenseId === expense.id
              ? "ring-1 ring-blue-400 border-blue-200"
              : "border-gray-100 hover:border-gray-300"
          }
          ${settlement.isFullySettled ? "opacity-90" : ""}`}
              onClick={() => setSelectedExpenseId(expense.id)}
            >
              {/* Main content */}
              <div className="flex items-start justify-between">
                {/* Left content */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {/* Category icon - more subtle */}
                  <div
                    className={`p-2 rounded-lg mt-1 ${
                      settlement.isFullySettled
                        ? "bg-green-50  text-green-600"
                        : "bg-gray-50 text-gray-600"
                    }`}
                  >
                    {getCategoryIcon(expense.category)}
                  </div>

                  {/* Text content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <h3 className="text-base font-medium text-gray-900 truncate">
                        {expense.title}
                      </h3>

                      {/* Tiny status dot */}
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          settlement.isFullySettled
                            ? "bg-green-500"
                            : isUserBuyer
                            ? "bg-blue-500"
                            : "bg-amber-400"
                        }`}
                      />
                    </div>

                    {/* Metadata row */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                      <div className="flex items-center gap-1">
                        <FiCalendar className="w-3 h-3 opacity-70" />
                        <span>{formatDate(expense.created_at)}</span>
                      </div>

                      {expense.total_participants > 1 && (
                        <div className="flex items-center gap-1">
                          <FiUsers className="w-3 h-3 opacity-70" />
                          <span>{expense.total_participants}</span>
                        </div>
                      )}

                      {/* Subtle settlement status text */}
                      {!settlement.isFullySettled && (
                        <div
                          className={`text-xs ${
                            isUserBuyer ? "text-blue-600" : "text-amber-600"
                          }`}
                        >
                          {isUserBuyer
                            ? `${settlement.settledCount}/${settlement.totalCount} settled`
                            : "Pending"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right amount */}
                <div className="text-right pl-2">
                  <div
                    className={`text-lg font-medium ${
                      isUserBuyer ? "text-gray-900" : "text-gray-700"
                    }`}
                  >
                    ₹
                    {isUserBuyer
                      ? expense.amount.toLocaleString()
                      : splitAmount.toLocaleString()}
                  </div>

                  {!isUserBuyer && expense.total_participants > 1 && (
                    <div className="text-xs text-gray-400 mt-0.5">
                      of ₹{expense.amount.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              {/* Fully settled indicator - very subtle */}

              {/* <div
                className={`absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl transition-all duration-300 ${
                  settlement.isFullySettled
                    ? "bg-green-400/50"
                    : "bg-gradient-to-r from-amber-400/30 to-amber-400/10"
                }`}
              /> */}
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={!!selectedExpenseId}
        onClose={() => setSelectedExpenseId(null)}
      >
        {selectedExpenseDetails && !detailsLoading ? (
          <div className="max-h-[90vh] overflow-hidden flex flex-col">
            <ModalHeader
              expense={selectedExpenseDetails}
              onClose={() => setSelectedExpenseId(null)}
            />

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                <AmountHero expense={selectedExpenseDetails} />

                <QuickStats expense={selectedExpenseDetails} />

                {/* Keep existing SettlementSummary - shows full details */}
                <SettlementSummary expense={selectedExpenseDetails} />

                <PaymentInfo expense={selectedExpenseDetails} />

                <SplitBreakdown expense={selectedExpenseDetails} />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-6 py-4">
              <ActionButtons onClose={() => setSelectedExpenseId(null)} />
            </div>
          </div>
        ) : (
          <LoadingState />
        )}
      </Modal>
    </div>
  );
}
