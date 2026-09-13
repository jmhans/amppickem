export default function PickCounter({ count, max }: { count: number; max: number }) {
  const complete = count >= max;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        complete ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
      }`}
    >
      {count} / {max} picks
    </span>
  );
}
