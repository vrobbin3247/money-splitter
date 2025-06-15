import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { FiUser } from "react-icons/fi";

const ProtectedRoute: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gradient-to-br from-white to-blue-50">
        <div className="relative w-24 h-24 mb-6">
          <div className="absolute inset-0 bg-blue-100 rounded-full animate-pulse"></div>
          <div className="absolute inset-4 bg-white rounded-full flex items-center justify-center">
            <FiUser className="w-8 h-8 text-blue-600 animate-bounce" />
          </div>
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-1">
          MoneySplitter
        </h2>
        <p className="text-gray-500">Loading your secure dashboard...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
