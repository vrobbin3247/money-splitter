import { useAuth } from "./context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import ExpenseForm from "../src/components/expenses/ExpenseForm";
import Dashboard from "../src/components/expenses/Dashboard";
import BottomNavigation from "./components/ui/BottomNavigation";
import { useState } from "react";
import { FiUser, FiPlus, FiLogOut } from "react-icons/fi";
import { FaChevronDown } from "react-icons/fa";
import Modal from "./components/ui/Modal";

export default function Home() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [activeTab, setActiveTab] = useState("expenses");

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to logout?")) {
      await signOut();
      navigate("/login");
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "expenses":
        return <Dashboard />;
      case "balances":
        return (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Balances
            </h3>
            <p className="text-gray-600">Coming soon...</p>
          </div>
        );
      case "insights":
        return (
          <div className="text-center py-12">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Insights
            </h3>
            <p className="text-gray-600">Coming soon...</p>
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  const getPageTitle = () => {
    switch (activeTab) {
      case "expenses":
        return { title: "Expenses", subtitle: "Split & track with roommates" };
      case "balances":
        return { title: "Balances", subtitle: "Who owes what" };
      case "insights":
        return { title: "Insights", subtitle: "Analytics & trends" };
      default:
        return { title: "Expenses", subtitle: "Split & track with roommates" };
    }
  };

  const pageInfo = getPageTitle();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-40">
        <div className="px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {pageInfo.title}
            </h1>
            <p className="text-sm text-gray-600">{pageInfo.subtitle}</p>
          </div>
          <button
            onClick={() => setShowProfile(true)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FiUser className="w-6 h-6 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Main Content with bottom padding for nav */}
      <div className="px-4 pt-6 pb-24 mb-16">{renderContent()}</div>

      {/* Floating Action Button - only show on expenses tab */}
      {activeTab === "expenses" && (
        <button
          onClick={() => setShowForm(true)}
          className="fixed bottom-20 right-6 w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 active:scale-95 transition-all z-40 flex items-center justify-center"
        >
          <FiPlus className="w-8 h-8" />
        </button>
      )}

      {/* Bottom Navigation */}
      <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Profile Modal */}
      <Modal isOpen={showProfile} onClose={() => setShowProfile(false)}>
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex justify-between items-center rounded-t-3xl">
          <h2 className="text-xl font-semibold text-gray-900">Profile</h2>
          <button
            onClick={() => setShowProfile(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FaChevronDown className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiUser className="w-10 h-10 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">
              {user?.email?.split("@")[0] || "User"}
            </h3>
            <p className="text-gray-600">{user?.email}</p>
          </div>

          <div className="space-y-3">
            <Link
              to="/profile"
              onClick={() => setShowProfile(false)}
              className="w-full bg-gray-100 text-gray-700 py-4 rounded-2xl font-semibold text-lg hover:bg-gray-200 transition-colors block text-center"
            >
              Edit Profile
            </Link>

            <button
              onClick={() => {
                setShowProfile(false);
                handleLogout();
              }}
              className="w-full bg-red-100 text-red-600 py-4 rounded-2xl font-semibold text-lg hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
            >
              <FiLogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </Modal>

      {/* Expense Form Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)}>
        <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex justify-between items-center rounded-t-3xl">
          <h2 className="text-xl font-semibold text-gray-900">Add Expense</h2>
          <button
            onClick={() => setShowForm(false)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FiPlus className="w-6 h-6 text-gray-600 rotate-45" />
          </button>
        </div>

        <ExpenseForm
          asPopup={false}
          onSuccess={() => {
            setShowForm(false);
            window.location.reload(); // optional
          }}
          onCancel={() => setShowForm(false)}
        />
      </Modal>
    </div>
  );
}
