import { useState, useEffect } from "react";
import { FaRupeeSign } from "react-icons/fa";
import {
  FiArrowRight,
  FiArrowLeft,
  FiX,
  FiCalendar,
  FiUsers,
  FiUser,
  FiCheck,
  FiAlertCircle,
} from "react-icons/fi";
import { supabase } from "../../lib/supabase";
import Modal from "../ui/Modal";

interface BalancesProps {
  user: { id: string };
}

interface Balance {
  id: string;
  user: { id: string; name: string; avatar: string; upi_id?: string };
  amount: number;
  type: "owe" | "owed";
  breakdown: {
    expenseId: string;
    expense: string;
    date: string;
    total: number;
    yourShare: number;
    paidBy: string;
    upi_id?: string;
    category: string;
  }[];
}

const Balances = ({ user }: BalancesProps) => {
  const [selectedBalance, setSelectedBalance] = useState<Balance | null>(null);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    async function calculateBalances() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get all UNsettled expenses where user was buyer
        const { data: buyerExpenses, error: buyerError } = await supabase
          .from("expenses")
          .select(
            `
      *,
      profiles!expenses_buyer_id_fkey(name, upi_id),
      expense_participants!inner(settlement_status, participant_id)
    `
          )
          .eq("buyer_id", user.id)
          .eq("expense_participants.settlement_status", false)
          .order("created_at", { ascending: false });

        if (buyerError) throw buyerError;

        // Get all UNsettled expenses where user was participant
        const { data: participantExpenses, error: participantError } =
          await supabase
            .from("expense_participants")
            .select(
              `
      expenses!inner(
        *,
        profiles!expenses_buyer_id_fkey(name, upi_id)
      )
    `
            )
            .eq("participant_id", user.id)
            .eq("settlement_status", false)
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
        const { data: allParticipants, error: participantsError } =
          await supabase
            .from("expense_participants")
            .select(
              `
      expense_id,
      participant_id,
      settlement_status,
      profiles!expense_participants_participant_id_fkey(name, upi_id)
    `
            )
            .in("expense_id", [
              ...(buyerExpenses?.map((e) => e.id) || []),
              ...(participantExpenses?.map((p: any) => p.expenses.id) || []),
            ]);

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
            // User paid for this expense
            participants.forEach((participant: any) => {
              if (
                participant.participant_id !== user.id &&
                !participant.settlement_status
              ) {
                const participantId = participant.participant_id;

                if (!userBalances[participantId]) {
                  userBalances[participantId] = {
                    user: {
                      id: participantId,
                      name: participant.profiles.name,
                      upi_id: participant.profiles.upi_id,
                    },
                    amount: 0,
                    breakdown: [],
                  };
                }

                userBalances[participantId].amount -= shareAmount;

                userBalances[participantId].breakdown.push({
                  expenseId: expense.id,
                  expense: expense.title,
                  date: new Date(expense.created_at).toLocaleDateString(),
                  total: expenseAmount,
                  yourShare: shareAmount,
                  paidBy: "You",
                  upi_id: participant.profiles.upi_id,
                  category: expense.category,
                });
              }
            });
          } else {
            // Someone else paid for this expense
            const userParticipant = participants.find(
              (p) => p.participant_id === user.id
            );
            if (userParticipant && !userParticipant.settlement_status) {
              const buyerId = expense.buyer_id;

              if (!userBalances[buyerId]) {
                userBalances[buyerId] = {
                  user: {
                    id: buyerId,
                    name: expense.profiles.name,
                    upi_id: expense.profiles.upi_id,
                  },
                  amount: 0,
                  breakdown: [],
                };
              }

              userBalances[buyerId].amount += shareAmount;

              userBalances[buyerId].breakdown.push({
                expenseId: expense.id,
                expense: expense.title,
                date: new Date(expense.created_at).toLocaleDateString(),
                total: expenseAmount,
                yourShare: shareAmount,
                paidBy: expense.profiles.name,
                upi_id: expense.profiles.upi_id,
                category: expense.category,
              });
            }
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
              upi_id: balance.user.upi_id,
            },
            amount: balance.amount,
            type: balance.amount > 0 ? ("owe" as "owe") : ("owed" as "owed"),
            breakdown: balance.breakdown,
          }));

        setBalances(balanceArray);
      } catch (error) {
        console.error("Error calculating balances:", error);
        setError("Failed to load balances. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    calculateBalances();
  }, [user]);

  const handleCompleteSettlement = async (balance: Balance) => {
    if (!balance.user.upi_id) {
      alert(
        "UPI ID not available for this user. Please ask them to update their profile."
      );
      return;
    }

    try {
      setSettling(true);

      // 1. Get all expense IDs involved in this balance
      const expenseIds = balance.breakdown.map((item) => item.expenseId);

      // 2. Create UPI payment link
      const upiLink = `upi://pay?pa=${
        balance.user.upi_id
      }&pn=${encodeURIComponent(balance.user.name)}&am=${Math.abs(
        balance.amount
      ).toFixed(2)}&cu=INR&tn=${encodeURIComponent(
        `Settlement for ${balance.breakdown.length} expenses`
      )}`;

      window.open(upiLink, "_blank");

      // 3. Wait for user confirmation
      const paymentConfirmed = await new Promise<boolean>((resolve) => {
        const confirmDialog = confirm(
          `Did you complete the UPI payment of ₹${Math.abs(
            balance.amount
          ).toFixed(2)} to ${
            balance.user.name
          }?\n\nClick OK if payment was successful, Cancel if not.`
        );
        resolve(confirmDialog);
      });

      if (!paymentConfirmed) {
        setSettling(false);
        return;
      }

      // 4. Create settlement record
      const { data: settlement, error: settlementError } = await supabase
        .from("settlements")
        .insert({
          expense_id: null,
          payer_id: user.id,
          payee_id: balance.user.id,
          amount: Math.abs(balance.amount),
          settled_at: new Date().toISOString(),
          is_settled: true,
          settlement_type: "complete",
          expense_details: balance.breakdown.map((b) => ({
            expense_id: b.expenseId,
            expense_title: b.expense,
            amount: b.yourShare,
          })),
          notes: `Complete settlement for ${balance.breakdown.length} expenses`,
        })
        .select()
        .single();

      if (settlementError) {
        console.error("Settlement record error:", settlementError);
        throw new Error("Failed to create settlement record");
      }

      // 5. FIXED: Mark ALL participants as settled for ALL expenses
      // This is the key fix - update settlement_status for BOTH users in each expense
      const { error: updateError } = await supabase
        .from("expense_participants")
        .update({
          settlement_status: true,
        })
        .in("expense_id", expenseIds)
        .in("participant_id", [user.id, balance.user.id]); // Update for BOTH users

      if (updateError) {
        console.error("Update participants error:", updateError);
        throw new Error("Failed to update settlement status");
      }

      // 6. Update UI state
      setBalances((prev) => prev.filter((b) => b.id !== balance.id));
      setSelectedBalance(null);

      // Show success feedback
      const successMessage =
        `✅ Settlement Successful!\n\n` +
        `Amount: ₹${Math.abs(balance.amount).toFixed(2)}\n` +
        `To: ${balance.user.name}\n` +
        `Expenses settled: ${balance.breakdown.length}\n\n` +
        `All related expenses have been marked as settled.`;

      alert(successMessage);
    } catch (error) {
      console.error("Settlement failed:", error);
      alert(
        `❌ Settlement Failed\n\n${
          error instanceof Error ? error.message : "Unknown error occurred"
        }\n\nPlease try again or contact support if the issue persists.`
      );
    } finally {
      setSettling(false);
    }
  };

  const handleSendReminder = async (balance: Balance) => {
    try {
      // Create a reminder message
      const reminderText =
        `Hi ${balance.user.name}! 👋\n\n` +
        `You have an outstanding balance of ₹${Math.abs(balance.amount).toFixed(
          2
        )} ` +
        `from ${balance.breakdown.length} shared expense${
          balance.breakdown.length > 1 ? "s" : ""
        }.\n\n` +
        `Please settle up when convenient. Thanks! 😊`;

      // For now, copy to clipboard (you can integrate with WhatsApp API later)
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(reminderText);
        alert(
          `📋 Reminder message copied to clipboard!\n\nYou can now paste and send it to ${balance.user.name}.`
        );
      } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = reminderText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
        alert(
          `📋 Reminder message copied to clipboard!\n\nYou can now paste and send it to ${balance.user.name}.`
        );
      }
    } catch (error) {
      console.error("Failed to copy reminder:", error);
      alert("Failed to create reminder. Please try again.");
    }
  };

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

        {/* UPI ID Display */}
        {balance.user.upi_id && (
          <div className="mt-4 p-3 bg-white/60 rounded-2xl">
            <div className="text-xs text-gray-600 mb-1">UPI ID</div>
            <div className="text-sm font-mono text-gray-800">
              {balance.user.upi_id}
            </div>
          </div>
        )}
      </div>
    );
  };

  interface ExpenseBreakdownProps {
    balance: Balance;
  }

  const ExpenseBreakdown = ({ balance }: ExpenseBreakdownProps) => (
    <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
          <FaRupeeSign className="w-4 h-4 text-green-600" />
        </div>
        <h4 className="font-semibold text-gray-900">Expense Breakdown</h4>
      </div>

      <div className="space-y-2">
        {balance.breakdown.map((item, index) => {
          const isPaidByUser = item.paidBy === "You";
          const amountColor = isPaidByUser ? "text-green-600" : "text-red-600";
          const amountSign = isPaidByUser ? "-" : "+";

          return (
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
                      isPaidByUser
                        ? "text-blue-600 font-medium"
                        : "text-gray-700"
                    }
                  >
                    {item.paidBy}
                  </span>
                </div>
              </div>
              <div className="text-right ml-4">
                <div className={`font-bold ${amountColor}`}>
                  {amountSign}₹{Math.abs(item.yourShare).toFixed(0)}
                </div>
                <div className="text-xs text-gray-500">
                  of ₹{item.total.toFixed(0)}
                </div>
              </div>
            </div>
          );
        })}
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
        disabled={settling}
        className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-2xl font-semibold hover:bg-gray-200 transition-all duration-200 active:scale-98 disabled:opacity-50"
      >
        Close
      </button>
      <button
        onClick={() => {
          if (balance.type === "owe") {
            handleCompleteSettlement(balance);
          } else {
            handleSendReminder(balance);
          }
        }}
        disabled={settling}
        className={`flex-1 ${
          balance.type === "owe"
            ? "bg-red-600 hover:bg-red-700 shadow-red-600/25"
            : "bg-green-600 hover:bg-green-700 shadow-green-600/25"
        } text-white py-4 rounded-2xl font-semibold transition-all duration-200 active:scale-98 shadow-lg disabled:opacity-50 flex items-center justify-center gap-2`}
      >
        {settling ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            Processing...
          </>
        ) : (
          <>
            {balance.type === "owe" ? (
              <>
                <FiCheck className="w-4 h-4" />
                Settle Up
              </>
            ) : (
              <>
                <FiAlertCircle className="w-4 h-4" />
                Send Reminder
              </>
            )}
          </>
        )}
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
        <div className="text-red-500 mb-4 flex items-center justify-center gap-2">
          <FiAlertCircle className="w-5 h-5" />
          {error}
        </div>
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
            <FaRupeeSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
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
