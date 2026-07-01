import React, { useEffect, useRef, useState } from 'react';
import { Assignee } from '../../entities/User';
import { getAssignmentPicker } from '../../utils/usersService';

interface Props {
    users?: Assignee[]; // 👈 (الحل) تم إزالة التعليق وجعلها اختيارية لحل الخطأ رقم 4
    selected: Assignee[];
    onChange: (users: Assignee[]) => void;
    disabled?: boolean;
    placeholder?: string;
}

const UserSelect: React.FC<Props> = ({
    users: externalUsers, // 👈 نستقبل الـ users المبعوتة من بره
    selected,
    onChange,
    disabled,
    placeholder = 'Assign users...',
}) => {
    const [inputValue, setInputValue] = useState('');
    const [internalUsers, setInternalUsers] = useState<Assignee[]>([]);
    const [filtered, setFiltered] = useState<Assignee[]>([]);
    const [open, setOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    const containerRef = useRef<HTMLDivElement>(null);

    // 👈 نحدد الداتا اللي هنستخدمها: لو مبعوتة من بره نستخدمها، لو لأ نستخدم الداخلية
    const activeUsers = externalUsers || internalUsers;

    // fetch users
    useEffect(() => {
        // 👈 لو مفيش داتا مبعوتة من بره، نجيبها من الـ API الداخلي بتاع المكون
        if (!externalUsers) {
            getAssignmentPicker().then(setInternalUsers).catch(console.error);
        }
    }, [externalUsers]);

    // filter logic
    useEffect(() => {
        if (!inputValue.trim()) {
            setFiltered([]);
            return;
        }

        const f = activeUsers.filter( // 👈 استخدمنا activeUsers بدلاً من users
            (u) =>
                (u.label?.toLowerCase().includes(inputValue.toLowerCase()) || 
                 u.name?.toLowerCase().includes(inputValue.toLowerCase()) || 
                 u.email?.toLowerCase().includes(inputValue.toLowerCase())) &&
                !selected.some((s) => s.id === u.id)
        );

        setFiltered(f);
        setOpen(f.length > 0);
        setHighlightedIndex(-1);
    }, [inputValue, activeUsers, selected]);

    // click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const addUser = (user: Assignee) => {
        onChange([...selected, user]);
        setInputValue('');
        setOpen(false);
    };

    const removeUser = (id: number) => {
        onChange(selected.filter((u) => u.id !== id));
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex((prev) =>
                prev < filtered.length - 1 ? prev + 1 : prev
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered[highlightedIndex]) {
                addUser(filtered[highlightedIndex]);
            }
        } else if (e.key === 'Backspace' && inputValue === '') {
            if (selected.length > 0) {
                removeUser(selected[selected.length - 1].id);
            }
        }
    };

    return (
        <div ref={containerRef} className="relative">
            <div className="flex flex-wrap gap-2 border rounded px-2 py-2 bg-white dark:bg-gray-900">
                {selected.map((user) => (
                    <span
                        key={user.id}
                        className="flex items-center bg-gray-200 text-xs px-2 py-1 rounded"
                    >
                        {user.label || user.name || user.email}
                        <button
                            onClick={() => removeUser(user.id)}
                            className="ml-1"
                        >
                            ×
                        </button>
                    </span>
                ))}

                <input
                    disabled={disabled}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="flex-grow bg-transparent outline-none text-sm"
                    onFocus={() => {
                        if (filtered.length > 0) setOpen(true);
                    }}
                />
            </div>

            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 border rounded shadow max-h-60 overflow-auto">
                    {filtered.map((user, i) => (
                        <button
                            key={user.id}
                            onClick={() => addUser(user)}
                            onMouseEnter={() => setHighlightedIndex(i)}
                            className={`w-full text-left px-4 py-2 text-sm ${
                                highlightedIndex === i
                                    ? 'bg-gray-200 dark:bg-gray-700'
                                    : ''
                            }`}
                        >
                            {user.label || user.name || user.email}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default UserSelect;