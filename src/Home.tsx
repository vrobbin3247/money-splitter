import { useAuth } from "./context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import ExpenseForm from "../src/components/expenses/ExpenseForm";
import Dashboard from "../src/components/expenses/Dashboard";
// import { useState } from "react";
import { FiUser } from "react-icons/fi";

export default function Home() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  // const [showForm, setShowForm] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="relative min-h-screen bg-[#fdfaf6] px-4 pt-6 pb-20 text-gray-800">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-semibold">Roommate Expense Sharing</h1>
        <Link to="/profile">
          <FiUser className="w-6 h-6 text-gray-700" />
        </Link>
      </div>
      {/* Logout Button */}
      <div className="space-y-3 mb-6">
        <button
          onClick={handleLogout}
          className="w-full text-sm bg-red-100 text-red-600 px-4 py-2 rounded-lg font-medium hover:bg-red-200 transition"
        >
          Logout
        </button>
      </div>
      {/* Dashboard */}
      <Dashboard /> {/* ⬅️ Just render your dashboard here */}
      {/* Add Expense Form */}
      <ExpenseForm asPopup={true} />
    </div>
  );
}
