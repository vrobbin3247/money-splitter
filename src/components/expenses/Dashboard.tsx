import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { FaRupeeSign } from "react-icons/fa";
import { FiUsers, FiX, FiUser, FiCalendar } from "react-icons/fi";
import { categories } from "../../components/constants/categories";
import Modal from "../ui/Modal";

interface Expense {
  id: string;
  title: string;
  amount: number;
  buyer_id: string;
  created_at: string;
  total_participants?: number; // Add this field
  buyer_name?: string; // Add this field
  participants?: Participant[]; // Add this field
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

  const calculateSplitAmount = (amount: number, totalParticipants: number) => {
    return Number(amount / totalParticipants);
  };

  // Helper function to get all participants for an expense
  const getAllParticipants = (expense: Expense) => {
    if (expense.participants && expense.buyer_name) {
      return Array.from(
        new Set([
          expense.buyer_name,
          ...expense.participants.map((p: any) => p.name),
        ])
      );
    }
    return [];
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

              // Get participants
              const { data: participantsData } = await supabase
                .from("expense_participants")
                .select(
                  `
                  participant_id,
                  profiles!inner(name)
                `
                )
                .eq("expense_id", expense.id);

              const participants: Participant[] =
                participantsData?.map((p: any) => ({
                  participant_id: p.participant_id,
                  name: p.profiles?.name || "Unknown",
                })) || [];

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

  interface SplitBreakdownProps {
    expense: ExpenseDetails;
  }

  const SplitBreakdown = ({ expense }: SplitBreakdownProps) => {
    const allParticipants = Array.from(
      new Set([
        expense.buyer_name,
        ...expense.participants.map((p: any) => p.name),
      ])
    );

    const shareAmount = calculateSplitAmount(
      expense.amount,
      expense.total_participants
    ).toFixed(0);

    return (
      <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
            <FiUsers className="w-4 h-4 text-blue-600" />
          </div>
          <h4 className="font-semibold text-gray-900">Split Breakdown</h4>
        </div>

        <div className="space-y-2">
          {allParticipants.map((name, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-3 px-4 bg-white rounded-xl border border-gray-100"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">
                    {name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="font-medium text-gray-900">{name}</span>
                {name === expense.buyer_name && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                    Paid
                  </span>
                )}
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900">₹{shareAmount}</div>
                <div className="text-xs text-gray-500">owes</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  interface ActionButtonsProps {
    onClose: () => void;
  }

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

  return (
    <div className="pb-6">
      {/* Expenses List */}
      <div className="space-y-4">
        {expenses.map((expense) => {
          const isUserBuyer = expense.buyer_id === user?.id;
          const allParticipants = getAllParticipants(expense);

          return (
            <div
              key={expense.id}
              className={`bg-white rounded-2xl py-2.5 px-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-all cursor-pointer ${
                selectedExpenseId === expense.id
                  ? "ring-2 ring-blue-500 border-blue-200"
                  : "hover:shadow-md"
              }`}
              onClick={() => setSelectedExpenseId(expense.id)}
            >
              <div className="flex items-center justify-between">
                {/* Left section with icon and details */}
                <div className="flex items-center space-x-4 flex-1 min-w-0">
                  {/* Category Icon with background */}
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 flex items-center text-2xl justify-center">
                      {getCategoryIcon(expense.category)}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">
                      {expense.title}
                    </h3>

                    <div className="flex items-center space-x-3">
                      {/* Payment status badge */}
                      <div className="flex-shrink-0">
                        {isUserBuyer ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                            You paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200">
                            Split expense
                          </span>
                        )}
                      </div>

                      {/* Participants count */}
                      {expense.total_participants &&
                        expense.total_participants > 1 && (
                          <div className="flex items-center space-x-1 text-xs text-gray-500">
                            <FiUsers className="w-3.5 h-3.5" />
                            <span>{expense.total_participants} people</span>
                          </div>
                        )}

                      {/* Date */}
                      <div className="flex items-center space-x-1 text-xs text-gray-500">
                        <FiCalendar className="w-3.5 h-3.5" />
                        <span>{formatDate(expense.created_at)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right section with amount */}
                <div className="flex-shrink-0 ml-6">
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900 tracking-tight">
                      ₹
                      <span>
                        {isUserBuyer
                          ? Number.isInteger(expense.amount)
                            ? expense.amount.toLocaleString()
                            : expense.amount.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                          : expense.total_participants
                          ? Number.isInteger(
                              calculateSplitAmount(
                                expense.amount,
                                expense.total_participants
                              )
                            )
                            ? Math.floor(
                                calculateSplitAmount(
                                  expense.amount,
                                  expense.total_participants
                                )
                              ).toLocaleString()
                            : calculateSplitAmount(
                                expense.amount,
                                expense.total_participants
                              ).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                          : "N/A"}
                      </span>
                    </div>
                    {!isUserBuyer && expense.total_participants && (
                      <div className="text-xs text-gray-500 mt-1">
                        of ₹{expense.amount.toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
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
