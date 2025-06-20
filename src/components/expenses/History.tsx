import { useState, useEffect } from "react";
import {
  FiCheck,
  FiArrowRight,
  FiCalendar,
  FiChevronDown,
  FiChevronUp,
  FiFilter,
  FiSearch,
  FiCreditCard,
} from "react-icons/fi";
import { supabase } from "../../lib/supabase";
import Modal from "../ui/Modal";

interface SettlementHistoryProps {
  user: { id: string };
}

interface Settlement {
  id: string;
  payer_id: string;
  payee_id: string;
  amount: number;
  settled_at: string;
  settlement_type: string;
  expense_details: any[];
  notes: string;
  payer_name: string;
  payee_name: string;
  expense_title?: string;
}

interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: {
    type: string;
    dateRange: string;
    participant: string;
  };
  onFiltersChange: (filters: any) => void;
  participants: Array<{ id: string; name: string }>;
}

const SettlementHistory = ({ user }: SettlementHistoryProps) => {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSettlement, setExpandedSettlement] = useState<string | null>(
    null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [participants, setParticipants] = useState<
    Array<{ id: string; name: string }>
  >([]);

  const [filters, setFilters] = useState({
    type: "all", // all, individual, complete
    dateRange: "all", // all, week, month, quarter
    participant: "all",
  });

  useEffect(() => {
    fetchSettlements();
    fetchParticipants();
  }, [user, filters]);

  const fetchParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name")
        .neq("id", user.id);

      if (error) throw error;
      setParticipants(data || []);
    } catch (error) {
      console.error("Error fetching participants:", error);
    }
  };

  const fetchSettlements = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("settlements")
        .select(
          `
          *,
          payer:profiles!settlements_payer_id_fkey(name),
          payee:profiles!settlements_payee_id_fkey(name),
          expense:expenses(title)
        `
        )
        .eq("is_settled", true)
        .or(`payer_id.eq.${user.id},payee_id.eq.${user.id}`)
        .order("settled_at", { ascending: false });

      // Apply filters
      if (filters.type !== "all") {
        query = query.eq("settlement_type", filters.type);
      }

      if (filters.participant !== "all") {
        query = query.or(
          `payer_id.eq.${filters.participant},payee_id.eq.${filters.participant}`
        );
      }

      if (filters.dateRange !== "all") {
        const now = new Date();
        let startDate = new Date();

        switch (filters.dateRange) {
          case "week":
            startDate.setDate(now.getDate() - 7);
            break;
          case "month":
            startDate.setMonth(now.getMonth() - 1);
            break;
          case "quarter":
            startDate.setMonth(now.getMonth() - 3);
            break;
        }

        query = query.gte("settled_at", startDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedSettlements = (data || []).map((settlement: any) => ({
        ...settlement,
        payer_name: settlement.payer?.name || "Unknown",
        payee_name: settlement.payee?.name || "Unknown",
        expense_title: settlement.expense?.title || null,
        expense_details: settlement.expense_details || [],
      }));

      setSettlements(formattedSettlements);
    } catch (error) {
      console.error("Error fetching settlements:", error);
      setError("Failed to load settlement history. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const filteredSettlements = settlements.filter((settlement) => {
    if (!searchQuery) return true;

    const searchLower = searchQuery.toLowerCase();
    return (
      settlement.payer_name.toLowerCase().includes(searchLower) ||
      settlement.payee_name.toLowerCase().includes(searchLower) ||
      settlement.expense_title?.toLowerCase().includes(searchLower) ||
      settlement.notes?.toLowerCase().includes(searchLower) ||
      settlement.expense_details.some((detail: any) =>
        detail.expense_title?.toLowerCase().includes(searchLower)
      )
    );
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return `${diffInDays} days ago`;

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const getSettlementDirection = (settlement: Settlement) => {
    const isUserPayer = settlement.payer_id === user.id;
    return {
      isUserPayer,
      fromName: isUserPayer ? "You" : settlement.payer_name,
      toName: isUserPayer ? settlement.payee_name : "You",
      description: isUserPayer
        ? `You paid ${settlement.payee_name}`
        : `${settlement.payer_name} paid you`,
    };
  };

  const FilterModal = ({
    isOpen,
    onClose,
    filters,
    onFiltersChange,
    participants,
  }: FilterModalProps) => (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-6 py-4 rounded-t-3xl">
          <h2 className="text-xl font-bold text-gray-900">
            Filter Settlements
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Settlement Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Settlement Type
            </label>
            <div className="space-y-2">
              {[
                { value: "all", label: "All Types" },
                { value: "individual", label: "Individual" },
                { value: "complete", label: "Complete" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    onFiltersChange({ ...filters, type: option.value })
                  }
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                    filters.type === option.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Date Range
            </label>
            <div className="space-y-2">
              {[
                { value: "all", label: "All Time" },
                { value: "week", label: "Last Week" },
                { value: "month", label: "Last Month" },
                { value: "quarter", label: "Last 3 Months" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    onFiltersChange({ ...filters, dateRange: option.value })
                  }
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                    filters.dateRange === option.value
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Participant */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              Participant
            </label>
            <div className="space-y-2">
              <button
                onClick={() =>
                  onFiltersChange({ ...filters, participant: "all" })
                }
                className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                  filters.participant === "all"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                All Participants
              </button>
              {participants.map((participant) => (
                <button
                  key={participant.id}
                  onClick={() =>
                    onFiltersChange({ ...filters, participant: participant.id })
                  }
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                    filters.participant === participant.id
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {participant.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
          <div className="flex gap-3">
            <button
              onClick={() => {
                onFiltersChange({
                  type: "all",
                  dateRange: "all",
                  participant: "all",
                });
                onClose();
              }}
              className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-2xl font-semibold hover:bg-gray-50 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settlement history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={fetchSettlements}
          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="pb-6">
      {/* Header with Search and Filter */}
      <div className="mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search settlements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filter Button */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-gray-900">
            Settlement History
          </h2>
          <button
            onClick={() => setShowFilters(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
          >
            <FiFilter className="w-4 h-4" />
            <span className="text-sm font-medium">Filter</span>
          </button>
        </div>

        {/* Active Filters Indicator */}
        {(filters.type !== "all" ||
          filters.dateRange !== "all" ||
          filters.participant !== "all") && (
          <div className="flex items-center gap-2 text-sm text-blue-600">
            <FiFilter className="w-4 h-4" />
            <span>Filters active</span>
          </div>
        )}
      </div>

      {/* Settlements List */}
      {filteredSettlements.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiCreditCard className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No settlements found
          </h3>
          <p className="text-gray-500">
            {searchQuery
              ? "Try adjusting your search or filters"
              : "Your settlement history will appear here"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSettlements.map((settlement) => {
            const direction = getSettlementDirection(settlement);
            const isExpanded = expandedSettlement === settlement.id;
            const isComplete = settlement.settlement_type === "complete";

            return (
              <div
                key={settlement.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100"
              >
                {/* Main Settlement Info */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        direction.isUserPayer ? "bg-red-100" : "bg-green-100"
                      }`}
                    >
                      {direction.isUserPayer ? (
                        <FiArrowRight className="w-6 h-6 text-red-600 rotate-180" />
                      ) : (
                        <FiArrowRight className="w-6 h-6 text-green-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {direction.description}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-2">
                        <FiCalendar className="w-4 h-4" />
                        {formatDate(settlement.settled_at)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`text-xl font-bold ${
                        direction.isUserPayer
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {direction.isUserPayer ? "-" : "+"}₹
                      {settlement.amount.toLocaleString()}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      <FiCheck className="w-4 h-4 text-green-500" />
                      <span className="capitalize">
                        {settlement.settlement_type}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Settlement Type Badge */}
                <div className="flex items-center justify-between mb-3">
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      isComplete
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {isComplete
                      ? "Complete Settlement"
                      : "Individual Settlement"}
                  </div>

                  {(isComplete || settlement.notes) && (
                    <button
                      onClick={() =>
                        setExpandedSettlement(isExpanded ? null : settlement.id)
                      }
                      className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                    >
                      <span>Details</span>
                      {isExpanded ? (
                        <FiChevronUp className="w-4 h-4" />
                      ) : (
                        <FiChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>

                {/* Individual Settlement - Single Expense */}
                {!isComplete && settlement.expense_title && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-sm font-medium text-gray-900">
                      {settlement.expense_title}
                    </div>
                  </div>
                )}

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                    {/* Complete Settlement - Multiple Expenses */}
                    {isComplete && settlement.expense_details.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">
                          Settled Expenses ({settlement.expense_details.length})
                        </h4>
                        <div className="space-y-2">
                          {settlement.expense_details.map(
                            (expense: any, index: number) => (
                              <div
                                key={index}
                                className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
                              >
                                <span className="text-sm text-gray-700">
                                  {expense.expense_title}
                                </span>
                                <span className="text-sm font-medium text-gray-900">
                                  ₹{expense.amount.toLocaleString()}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {settlement.notes && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-2">
                          Notes
                        </h4>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-sm text-gray-700">
                            {settlement.notes}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Filter Modal */}
      <FilterModal
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        onFiltersChange={setFilters}
        participants={participants}
      />
    </div>
  );
};

export default SettlementHistory;
