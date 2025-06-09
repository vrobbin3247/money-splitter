import { useAuth } from "./context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import ExpenseForm from "../src/components/expenses/ExpenseForm";

export default function Home() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="p-4">
      <div className="space-y-4">
        <Link
          to="/profile"
          className="block bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-center"
        >
          Edit Profile
        </Link>
        <button
          onClick={handleLogout}
          className="w-full bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Logout
        </button>
        <ExpenseForm asPopup={true} />
      </div>
    </div>
  );
}
