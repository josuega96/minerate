import React from 'react';

interface InputGroupProps {
  label: string;
  name: string;
  value: string | number | undefined;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: 'text' | 'number';
  required?: boolean;
  placeholder?: string;
  step?: string;
  icon?: React.ReactNode;
}

export const InputGroup: React.FC<InputGroupProps> = ({ 
  label, name, value, onChange, type = 'text', required = false, placeholder, step, icon 
}) => {
  return (
    <div className="mb-3">
      <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          type={type}
          name={name}
          value={value === undefined ? '' : value}
          onChange={onChange}
          required={required}
          step={step}
          placeholder={placeholder}
          className="w-full bg-white border border-stone-300 text-stone-900 text-sm rounded-lg focus:ring-emerald-500 focus:border-emerald-500 block p-3 shadow-sm transition-colors"
        />
        {icon && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-stone-400">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};