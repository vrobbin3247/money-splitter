import React from "react";
import {
  FiUsers,
  FiX,
  FiUser,
  FiCalendar,
  FiCheck,
  FiClock,
} from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";
import { useAuth } from "../../context/AuthContext";

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

interface Participant {
  id?: string;
  participant_id: string;
  name: string;
  settlement_status?: boolean;
}

interface SettlementFeedback {
  show: boolean;
  type: "success" | "error";
  message: string;
  participantName?: string;
}

// Modal Header Component
interface ModalHeaderProps {
  expense: ExpenseDetails;
  onClose: () => void;
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  expense,
  onClose,
}) => {
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

  return (
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
};

// Amount Hero Component
interface AmountHeroProps {
  expense: ExpenseDetails;
}

export const AmountHero: React.FC<AmountHeroProps> = ({ expense }) => {
  const shareAmount = (expense.amount / expense.total_participants).toFixed(0);

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

// Quick Stats Component
interface QuickStatsProps {
  expense: ExpenseDetails;
}

export const QuickStats: React.FC<QuickStatsProps> = ({ expense }) => (
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
          <div className="text-xs text-purple-700 font-medium">Per person</div>
        </div>
      </div>
    </div>
  </div>
);

// Payment Info Component
interface PaymentInfoProps {
  expense: ExpenseDetails;
}

export const PaymentInfo: React.FC<PaymentInfoProps> = ({ expense }) => (
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

// Settlement Feedback Toast Component
interface SettlementFeedbackToastProps {
  settlementFeedback: SettlementFeedback;
}

export const SettlementFeedbackToast: React.FC<
  SettlementFeedbackToastProps
> = ({ settlementFeedback }) => {
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

// Settlement Summary Component
interface SettlementSummaryProps {
  expense: ExpenseDetails;
}

export const SettlementSummary: React.FC<SettlementSummaryProps> = ({
  expense,
}) => {
  const totalParticipants = expense.total_participants;
  const settledCount = expense.participants.filter(
    (p) => p.settlement_status
  ).length;
  const settlementProgress = (settledCount / totalParticipants) * 100;
  const isFullySettled = settledCount === totalParticipants;

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
          {settledCount}/{totalParticipants} settled
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

// Split Breakdown Component
interface SplitBreakdownProps {
  expense: ExpenseDetails;
  settlementFeedback: SettlementFeedback;
  settlingParticipants: Set<string>;
  onMarkAsSettled: (participantId: string, expenseId: string) => Promise<void>;
}

export const SplitBreakdown: React.FC<SplitBreakdownProps> = ({
  expense,
  settlementFeedback,
  settlingParticipants,
  onMarkAsSettled,
}) => {
  const { user } = useAuth();
  const isCurrentUserBuyer = expense.buyer_id === user?.id;

  const calculateSplitAmount = (amount: number, totalParticipants: number) => {
    return Number(amount / totalParticipants);
  };

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
            (isCurrentUserBuyer && !participant.isCurrentUser) ||
            (participant.isCurrentUser && !participant.isBuyer);

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
                      <span className="ml-1 text-xs text-gray-500">(You)</span>
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
                    onClick={() => {
                      if (participant.isCurrentUser || isCurrentUserBuyer) {
                        onMarkAsSettled(participant.id, expense.id);
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

// Action Buttons Component
interface ActionButtonsProps {
  onClose: () => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({ onClose }) => (
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
