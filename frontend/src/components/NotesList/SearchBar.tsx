import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  className?: string;
  initialValue?: string;
  debounceMs?: number;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = 'Search notes...',
  className = '',
  initialValue = '',
  debounceMs = 300,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialValue);

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      onSearch(searchQuery);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, onSearch, debounceMs]);

  const handleClear = () => {
    setSearchQuery('');
    onSearch('');
  };

  return (
    <div className={`relative ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-0 flex items-center pointer-events-none">
        <MagnifyingGlassIcon className="h-4 w-4 text-on-surface-variant/50" />
      </div>

      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="block w-full pl-6 pr-8 py-2 bg-transparent border-0 border-b border-outline-variant/15 text-on-surface placeholder-on-surface-variant/40 focus:outline-none focus:border-secondary focus:ring-0 transition-colors duration-200 text-sm"
        placeholder={placeholder}
      />

      {searchQuery && (
        <div className="absolute inset-y-0 right-0 pr-0 flex items-center">
          <button
            onClick={handleClear}
            className="text-on-surface-variant/50 hover:text-on-surface transition-colors"
            title="Clear search"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
