import { useAuth } from "./context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import ExpenseForm from "../src/components/expenses/ExpenseForm";
import Dashboard from "../src/components/expenses/Dashboard";
import { useState } from "react";
import { FiUser, FiPlus, FiLogOut } from "react-icons/fi";

export default function Home() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const handleLogout = async () => {
    if (window.confirm("Are you sure you want to logout?")) {
      await signOut();
      navigate("/login");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 z-40">
        <div className="px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
            <p className="text-sm text-gray-600">
              Split & track with roommates
            </p>
          </div>
          <button
            onClick={() => setShowProfile(true)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FiUser className="w-6 h-6 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 pt-6 pb-24">
        <Dashboard />
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 active:scale-95 transition-all z-40 flex items-center justify-center"
      >
        <FiPlus className="w-8 h-8" />
      </button>

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-h-[70vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex justify-between items-center rounded-t-3xl">
              <h2 className="text-xl font-semibold text-gray-900">Profile</h2>
              <button
                onClick={() => setShowProfile(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <FiUser className="w-6 h-6 text-gray-600" />
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
          </div>
        </div>
      )}

      {/* Expense Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 p-4 flex justify-between items-center rounded-t-3xl">
              <h2 className="text-xl font-semibold text-gray-900">
                Add Expense
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <FiPlus className="w-6 h-6 text-gray-600 rotate-45" />
              </button>
            </div>

            <div className="p-4">
              <ExpenseForm
                asPopup={false}
                onSuccess={() => {
                  setShowForm(false);
                  // Optionally refresh the dashboard
                  window.location.reload();
                }}
                onCancel={() => setShowForm(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
