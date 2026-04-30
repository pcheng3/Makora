const severityStyles: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  blocking: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  suggestion: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  nit: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const categoryStyles: Record<string, string> = {
  positive: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  question: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  test_suggestion: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400",
};

export default function SeverityBadge({
  severity,
  category,
}: {
  severity?: string | null;
  category: string;
}) {
  if (severity && severityStyles[severity]) {
    return (
      <span
        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${severityStyles[severity]}`}
      >
        {severity}
      </span>
    );
  }

  const style = categoryStyles[category] || categoryStyles.positive;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${style}`}>
      {category === "test_suggestion" ? "test" : category}
    </span>
  );
}
