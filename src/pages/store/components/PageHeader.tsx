import { useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

interface PageHeaderProps {
  title: string;
  description?: string;
  showBackButton?: boolean;
  backTo?: string;
}

export default function PageHeader({
  title,
  description,
  showBackButton = true,
  backTo = '/store',
}: PageHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="mb-6">
      {showBackButton && (
        <button
          onClick={() => navigate(backTo)}
          className="mb-4 flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          <FiArrowLeft className="h-5 w-5" />
          Back
        </button>
      )}
      <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      {description && <p className="mt-2 text-gray-600">{description}</p>}
    </div>
  );
}
