import { FiList, FiBarChart, FiPlus, FiClock } from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onAddExpense?: () => void; // New prop for add expense action
}

export default function BottomNavigation({
  activeTab,
  onTabChange,
  onAddExpense,
}: BottomNavigationProps) {
  const tabs = [
    {
      id: "expenses",
      label: "Expenses",
      icon: FiList,
    },
    {
      id: "balances",
      label: "Balances",
      icon: FaRupeeSign,
    },
    {
      id: "history",
      label: "History",
      icon: FiClock,
    },
    {
      id: "insights",
      label: "Insights",
      icon: FiBarChart,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-safe">
      {/* Add safe area padding for iOS devices */}
      <div className="flex relative">
        {/* Main navigation tabs */}
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 py-3 px-2 flex flex-col items-center justify-center transition-colors ${
                isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
              }`}
              aria-label={tab.label}
            >
              <div className="relative">
                <Icon
                  className={`w-6 h-6 transition-transform ${
                    isActive ? "scale-110" : "scale-100"
                  }`}
                />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-600 rounded-full"></span>
                )}
              </div>
              <span className="text-xs mt-1 font-medium">{tab.label}</span>
            </button>
          );
        })}

        {/* Floating action button */}
        {onAddExpense && (
          <div className="absolute left-1/2 transform -translate-x-1/2 -top-8">
            <button
              onClick={onAddExpense}
              className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Add expense"
            >
              <FiPlus className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
