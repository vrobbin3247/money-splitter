import { useState, useEffect } from "react";
import {
  FiArrowRight,
  FiArrowLeft,
  FiX,
  FiDollarSign,
  // FiLoader,
  FiCalendar,
  FiUsers,
  FiUser,
} from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";
import { supabase } from "../../lib/supabase";
import Modal from "../ui/Modal";

interface BalancesProps {
  user: { id: string };
}

// interface Expense {
//   id: string;
//   title: string;
//   amount: number;
//   buyer_id: string;
//   created_at: string;
//   category: string;
//   profiles: { name: string };
// }

interface Balance {
  id: string;
  user: { id: string; name: string; avatar: string };
  amount: number;
  type: "owe" | "owed";
  breakdown: {
    expense: string;
    date: string;
    total: number;
    yourShare: number;
    paidBy: string;
    category: string;
  }[];
}

const Balances = ({ user }: BalancesProps) => {
  const [selectedBalance, setSelectedBalance] = useState<Balance | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function calculateBalances() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get all expenses where user was buyer or participant
        const { data: buyerExpenses, error: buyerError } = await supabase
          .from("expenses")
          .select(
            `
            *,
            profiles!expenses_buyer_id_fkey(name)
          `
          )
          .eq("buyer_id", user.id)
          .order("created_at", { ascending: false });

        if (buyerError) throw buyerError;

        const { data: participantExpenses, error: participantError } =
          await supabase
            .from("expense_participants")
            .select(
              `
            expenses!inner(
              *,
              profiles!expenses_buyer_id_fkey(name)
            )
          `
            )
            .eq("participant_id", user.id)
            .order("created_at", { ascending: false });

        if (participantError) throw participantError;

        // Get all unique expenses involving the user
        const participantExpenseList =
          participantExpenses?.map((p: any) => p.expenses) || [];
        const combined = [...(buyerExpenses || []), ...participantExpenseList];
        const uniqueExpenses = Object.values(
          combined.reduce((acc: any, exp: any) => {
            acc[exp.id] = exp;
            return acc;
          }, {})
        );

        if (uniqueExpenses.length === 0) {
          setBalances([]);
          return;
        }

        // Get all participants for each expense
        const expenseIds = uniqueExpenses.map((exp: any) => exp.id);
        const { data: allParticipants, error: participantsError } =
          await supabase
            .from("expense_participants")
            .select(
              `
            expense_id,
            participant_id,
            profiles!expense_participants_participant_id_fkey(name)
          `
            )
            .in("expense_id", expenseIds);

        if (participantsError) throw participantsError;

        // Calculate balances
        const userBalances: any = {};

        uniqueExpenses.forEach((expense: any) => {
          const participants =
            allParticipants?.filter((p: any) => p.expense_id === expense.id) ||
            [];

          const totalSplitters = participants.length;
          const expenseAmount = parseFloat(expense.amount.toString());
          const shareAmount = expenseAmount / totalSplitters;

          if (totalSplitters === 0) return;

          if (expense.buyer_id === user.id) {
            participants.forEach((participant: any) => {
              if (participant.participant_id !== user.id) {
                const participantId = participant.participant_id;

                if (!userBalances[participantId]) {
                  userBalances[participantId] = {
                    user: {
                      id: participantId,
                      name: participant.profiles.name,
                    },
                    amount: 0,
                    breakdown: [],
                  };
                }

                userBalances[participantId].amount -= shareAmount;

                userBalances[participantId].breakdown.push({
                  expense: expense.title,
                  date: new Date(expense.created_at).toLocaleDateString(),
                  total: expenseAmount,
                  yourShare: shareAmount,
                  paidBy: "You",
                  category: expense.category,
                });
              }
            });
          } else {
            const buyerId = expense.buyer_id;

            if (!userBalances[buyerId]) {
              userBalances[buyerId] = {
                user: { id: buyerId, name: expense.profiles.name },
                amount: 0,
                breakdown: [],
              };
            }

            userBalances[buyerId].amount += shareAmount;

            userBalances[buyerId].breakdown.push({
              expense: expense.title,
              date: new Date(expense.created_at).toLocaleDateString(),
              total: expenseAmount,
              yourShare: shareAmount,
              paidBy: expense.profiles.name,
              category: expense.category,
            });
          }
        });

        // Convert to array and filter out zero balances
        const balanceArray = Object.values(userBalances)
          .filter((balance: any) => Math.abs(balance.amount) >= 0.01)
          .map((balance: any) => ({
            id: balance.user.id,
            user: {
              id: balance.user.id,
              name: balance.user.name,
              avatar: balance.user.name.charAt(0).toUpperCase(),
            },
            amount: balance.amount,
            type: balance.amount > 0 ? ("owe" as "owe") : ("owed" as "owed"),
            breakdown: balance.breakdown,
          }));

        setBalances(balanceArray);
      } catch (error) {
        setError("Failed to load balances. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    calculateBalances();
  }, [user]);

  // Modal Components matching Dashboard style
  interface ModalHeaderProps {
    balance: Balance;
    onClose: () => void;
  }

  const ModalHeader = ({ balance, onClose }: ModalHeaderProps) => (
    <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-6 py-4 rounded-t-3xl">
      <div className="flex justify-between items-start">
        <div className="flex-1 pr-4">
          <h2 className="text-xl font-bold text-gray-900 mb-1">
            Balance with {balance.user.name}
          </h2>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <FiUser className="w-4 h-4" />
            {balance.type === "owe" ? "You owe" : "Owes you"}
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
    balance: Balance;
  }

  const AmountHero = ({ balance }: AmountHeroProps) => {
    const isOwed = balance.type === "owed";

    return (
      <div
        className={`text-center ${
          isOwed
            ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-100"
            : "bg-gradient-to-br from-red-50 to-rose-50 border-red-100"
        } rounded-3xl p-6 border`}
      >
        <div
          className={`text-sm font-medium ${
            isOwed ? "text-green-700" : "text-red-700"
          } mb-2`}
        >
          {isOwed ? "You are owed" : "You owe"}
        </div>
        <div
          className={`text-5xl font-bold ${
            isOwed ? "text-green-600" : "text-red-600"
          } mb-4`}
        >
          ₹{Math.abs(balance.amount).toLocaleString()}
        </div>
        <div
          className={`inline-flex items-center gap-2 bg-white/80 rounded-full px-4 py-2 ${
            isOwed ? "text-green-800" : "text-red-800"
          }`}
        >
          <span className="text-sm">
            From {balance.breakdown.length} expense
            {balance.breakdown.length > 1 ? "s" : ""}
          </span>
        </div>
      </div>
    );
  };

  interface QuickStatsProps {
    balance: Balance;
  }

  const QuickStats = ({ balance }: QuickStatsProps) => (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <FiUsers className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {balance.breakdown.length}
            </div>
            <div className="text-xs text-blue-700 font-medium">
              Shared expenses
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
              {(Math.abs(balance.amount) / balance.breakdown.length).toFixed(0)}
            </div>
            <div className="text-xs text-purple-700 font-medium">
              Avg per expense
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  interface PersonInfoProps {
    balance: Balance;
  }

  const PersonInfo = ({ balance }: PersonInfoProps) => (
    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
          <FiUser className="w-4 h-4 text-blue-600" />
        </div>
        <h4 className="font-semibold text-gray-900">Person Details</h4>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center border-2 border-blue-200">
              <span className="text-lg font-bold text-blue-700">
                {balance.user.avatar}
              </span>
            </div>
            <div>
              <div className="font-semibold text-gray-900">
                {balance.user.name}
              </div>
              <div className="text-sm text-gray-500">
                {balance.type === "owe"
                  ? "You owe this person"
                  : "This person owes you"}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div
              className={`text-lg font-bold ${
                balance.type === "owe" ? "text-red-600" : "text-green-600"
              }`}
            >
              ₹{Math.abs(balance.amount).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">Total balance</div>
          </div>
        </div>
      </div>
    </div>
  );

  interface ExpenseBreakdownProps {
    balance: Balance;
  }

  const ExpenseBreakdown = ({ balance }: ExpenseBreakdownProps) => (
    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
          <FiDollarSign className="w-4 h-4 text-green-600" />
        </div>
        <h4 className="font-semibold text-gray-900">Expense Breakdown</h4>
      </div>

      <div className="space-y-2">
        {balance.breakdown.map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-between py-3 px-4 bg-white rounded-xl border border-gray-100"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">
                {item.expense}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <FiCalendar className="w-3 h-3" />
                  {item.date}
                </div>
                {item.category && (
                  <div className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded font-medium">
                    {item.category}
                  </div>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Paid by:{" "}
                <span
                  className={
                    item.paidBy === "You"
                      ? "text-blue-600 font-medium"
                      : "text-gray-700"
                  }
                >
                  {item.paidBy}
                </span>
              </div>
            </div>
            <div className="text-right ml-4">
              <div className="font-bold text-gray-900">
                ₹{item.yourShare.toFixed(0)}
              </div>
              <div className="text-xs text-gray-500">
                of ₹{item.total.toFixed(0)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  interface ActionButtonsProps {
    balance: Balance;
    onClose: () => void;
  }

  const ActionButtons = ({ balance, onClose }: ActionButtonsProps) => (
    <div className="flex gap-3 pt-2">
      <button
        onClick={onClose}
        className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-2xl font-semibold hover:bg-gray-200 transition-all duration-200 active:scale-98"
      >
        Close
      </button>
      <button
        className={`flex-1 ${
          balance.type === "owe"
            ? "bg-red-600 hover:bg-red-700 shadow-red-600/25"
            : "bg-green-600 hover:bg-green-700 shadow-green-600/25"
        } text-white py-4 rounded-2xl font-semibold transition-all duration-200 active:scale-98 shadow-lg`}
      >
        {balance.type === "owe" ? "Settle Up" : "Remind"}
      </button>
    </div>
  );

  const LoadingState = () => (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4">
          <div className="w-full h-full border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        </div>
        <p className="text-gray-600 font-medium">Loading balance details...</p>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Calculating balances...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const totalOwed = balances
    .filter((b) => b.type === "owed")
    .reduce((sum, b) => sum + Math.abs(b.amount), 0);
  const totalOwe = balances
    .filter((b) => b.type === "owe")
    .reduce((sum, b) => sum + b.amount, 0);
  const netBalance = totalOwed - totalOwe;

  return (
    <div className="pb-6">
      <div className="space-y-6">
        {/* Net Balance Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-center">
            <div className="text-sm text-gray-500 mb-2">Your net balance</div>
            <div
              className={`text-3xl font-bold ${
                netBalance >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {netBalance >= 0 ? "+" : ""}₹{netBalance.toFixed(2)}
            </div>
            <div className="text-sm text-gray-500 mt-2">
              {netBalance >= 0 ? "You are owed overall" : "You owe overall"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-100">
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">
                ₹{totalOwed.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500">You're owed</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-red-600">
                ₹{totalOwe.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500">You owe</div>
            </div>
          </div>
        </div>

        {/* Individual Balances or Empty State */}
        {balances.length > 0 ? (
          <div className="space-y-4">
            {balances.map((balance) => (
              <div
                key={balance.id}
                className="bg-white rounded-2xl py-2.5 px-4 shadow-sm border border-gray-100 active:scale-[0.98] transition-all cursor-pointer hover:shadow-md"
                onClick={() => setSelectedBalance(balance)}
              >
                <div className="flex items-center justify-between">
                  {/* Left section with avatar and details */}
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                        {balance.user.avatar}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">
                        {balance.user.name}
                      </h3>

                      <div className="flex items-center space-x-3">
                        {/* Balance type badge */}
                        <div className="flex-shrink-0">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              balance.type === "owe"
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-green-50 text-green-700 border border-green-200"
                            }`}
                          >
                            {balance.type === "owe" ? "You owe" : "Owes you"}
                          </span>
                        </div>

                        {/* Expense count */}
                        <div className="flex items-center space-x-1 text-xs text-gray-500">
                          <FiUsers className="w-3.5 h-3.5" />
                          <span>
                            {balance.breakdown.length} expense
                            {balance.breakdown.length > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right section with amount */}
                  <div className="flex-shrink-0 ml-6 flex items-center gap-3">
                    <div className="text-right">
                      <div
                        className={`text-xl font-bold tracking-tight ${
                          balance.type === "owe"
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        ₹{Math.abs(balance.amount).toFixed(2)}
                      </div>
                    </div>

                    {balance.type === "owe" ? (
                      <FiArrowRight className="w-5 h-5 text-red-500" />
                    ) : (
                      <FiArrowLeft className="w-5 h-5 text-green-500" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <FiDollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              All settled up!
            </h3>
            <p className="text-gray-600 mb-6">
              No outstanding balances with your roommates.
            </p>
          </div>
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={!!selectedBalance}
        onClose={() => setSelectedBalance(null)}
      >
        {selectedBalance ? (
          <div className="max-h-[90vh] overflow-hidden flex flex-col">
            <ModalHeader
              balance={selectedBalance}
              onClose={() => setSelectedBalance(null)}
            />

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                <AmountHero balance={selectedBalance} />

                <QuickStats balance={selectedBalance} />

                <PersonInfo balance={selectedBalance} />

                <ExpenseBreakdown balance={selectedBalance} />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-6 py-4">
              <ActionButtons
                balance={selectedBalance}
                onClose={() => setSelectedBalance(null)}
              />
            </div>
          </div>
        ) : (
          <LoadingState />
        )}
      </Modal>
    </div>
  );
};

export default Balances;
