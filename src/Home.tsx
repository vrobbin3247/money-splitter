import { useAuth } from "./context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import ExpenseForm from "../src/components/expenses/ExpenseForm";
import Dashboard from "../src/components/expenses/Dashboard";
import BottomNavigation from "./components/ui/BottomNavigation";
import { supabase } from "../src/lib/supabase";
import { useState, useEffect } from "react";
import { FiUser, FiPlus, FiLogOut } from "react-icons/fi";
import { FaChevronDown, FaBell } from "react-icons/fa";
import Modal from "./components/ui/Modal";
import Balances from "./components/expenses/Balances";
import Analysis from "./components/expenses/Analysis";

export default function Home() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [activeTab, setActiveTab] = useState("expenses");
  const [profile, setProfile] = useState<{ name: string } | null>(null); // Add profile state

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to logout?")) {
      await signOut();
      navigate("/login");
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", user.id)
          .single();

        if (data) setProfile(data);
      }
    };

    fetchProfile();
  }, [user]);

  const renderContent = () => {
    switch (activeTab) {
      case "expenses":
        return <Dashboard />;
      case "balances":
        return <Balances user={user} />;
      case "insights":
        return <Analysis user={user} />;
      default:
        return <Dashboard />;
    }
  };

  // const getPageTitle = () => {
  //   switch (activeTab) {
  //     case "expenses":
  //       return { title: "Expenses", subtitle: "Split & track with roommates" };
  //     case "balances":
  //       return { title: "Balances", subtitle: "Who owes what" };
  //     case "insights":
  //       return { title: "Insights", subtitle: "Analytics & trends" };
  //     default:
  //       return { title: "Expenses", subtitle: "Split & track with roommates" };
  //   }
  // };

  // const pageInfo = getPageTitle();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Enhanced Fixed Header */}
      <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 z-40 shadow-sm">
        <div className="px-4 sm:px-6 py-3 flex justify-between items-center max-w-7xl mx-auto">
          {/* Profile Button - Left */}
          <button
            onClick={() => setShowProfile(true)}
            aria-label="User profile"
            className="p-2 rounded-full transition-colors hover:bg-gray-100 active:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <FiUser className="w-5 h-5 text-gray-700" />
          </button>

          {/* App Title - Center */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
              MoneySplitter
            </h1>
          </div>

          {/* Notifications - Right */}
          <div className="relative">
            <button
              aria-label="Notifications"
              className="p-2 rounded-full transition-colors hover:bg-gray-100 active:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 relative"
            >
              <FaBell className="w-5 h-5 text-gray-700" />
              {/* Notification badge */}
              <span className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
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
              {profile?.name || user?.email?.split("@")[0] || "User"}{" "}
              {/* Updated to use profile name */}
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
