import {
  FaUtensils,
  FaTaxi,
  FaHome,
  FaLightbulb,
  FaShoppingBasket,
} from "react-icons/fa";

export const categories = [
  {
    value: "food",
    label: "Food",
    icon: <FaUtensils className="text-red-500" />,
  },
  {
    value: "travel",
    label: "Travel",
    icon: <FaTaxi className="text-blue-500" />,
  },
  {
    value: "rent",
    label: "Rent",
    icon: <FaHome className="text-green-500" />,
  },
  {
    value: "utilities",
    label: "Utilities",
    icon: <FaLightbulb className="text-yellow-500" />,
  },
  {
    value: "misc",
    label: "Misc",
    icon: <FaShoppingBasket className="text-gray-500" />,
  },
];
