import { FiList, FiDollarSign, FiBarChart } from "react-icons/fi";

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function BottomNavigation({
  activeTab,
  onTabChange,
}: BottomNavigationProps) {
  const tabs = [
    {
      id: "expenses",
      label: "Expenses",
      icon: FiList,
      description: "Recent expenses",
    },
    {
      id: "balances",
      label: "Balances",
      icon: FiDollarSign,
      description: "Who owes what",
    },
    {
      id: "insights",
      label: "Insights",
      icon: FiBarChart,
      description: "Analytics & trends",
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 py-3 px-2 flex flex-col items-center justify-center transition-colors ${
                isActive
                  ? "text-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Icon
                className={`w-6 h-6 mb-1 ${
                  isActive ? "text-blue-600" : "text-gray-600"
                }`}
              />
              <span
                className={`text-xs font-medium ${
                  isActive ? "text-blue-600" : "text-gray-600"
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
