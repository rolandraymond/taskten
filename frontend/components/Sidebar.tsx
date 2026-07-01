import React, { useState } from 'react'; // شلنا useEffect لأننا مش محتاجينه هنا خلاص
import { useNavigate, useLocation } from 'react-router-dom';
import { Area } from '../entities/Area';
import { Note } from '../entities/Note';
import { Tag } from '../entities/Tag';
import SidebarAreas from './Sidebar/SidebarAreas';
import SidebarFooter from './Sidebar/SidebarFooter';
import SidebarNav from './Sidebar/SidebarNav';
import SidebarNotes from './Sidebar/SidebarNotes';
import SidebarHabits from './Sidebar/SidebarHabits';
import SidebarProjects from './Sidebar/SidebarProjects';
import SidebarTags from './Sidebar/SidebarTags';
import SidebarViews from './Sidebar/SidebarViews';
import { KeyboardShortcutsConfig } from '../utils/keyboardShortcutsService';
import { usePermissions } from '../hooks/usePermissions';

// 🗑️ شلنا سطر الـ import بتاع getFeatureFlags و FeatureFlags من هنا

interface SidebarProps {
    isSidebarOpen: boolean;
    setIsSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
    currentUser: { email: string; role?: string };
    isDarkMode: boolean;
    toggleDarkMode: () => void;
    openTaskModal: () => void;
    openProjectModal: () => void;
    openNoteModal: (note: Note | null) => void;
    openAreaModal: (area: Area | null) => void;
    openTagModal: (tag: Tag | null) => void;
    openNewHabit: () => void;
    notes: Note[];
    areas: Area[];
    tags: Tag[];
    keyboardShortcuts?: KeyboardShortcutsConfig | null;
}

const Sidebar: React.FC<SidebarProps> = ({
    isSidebarOpen,
    setIsSidebarOpen,
    currentUser,
    isDarkMode,
    toggleDarkMode,
    openTaskModal,
    openProjectModal,
    openNoteModal,
    openAreaModal,
    openTagModal,
    openNewHabit,
    notes,
    areas,
    tags,
    keyboardShortcuts,
}) => {
    const navigate = useNavigate();
    const location = useLocation();

    const { isClient } = usePermissions();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    // 🗑️ شلنا الـ useState بتاع featureFlags
    // 🗑️ شلنا الـ useEffect اللي كان بيعمل fetch للـ flags

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    const handleNavClick = (path: string, title: string) => {
        navigate(path, { state: { title } });
        if (window.innerWidth < 1024) {
            setIsSidebarOpen(false);
        }
    };

    return (
        <div
            className={`fixed top-16 left-0 ${isSidebarOpen ? 'w-full sm:w-72' : 'w-0'} h-[calc(100vh-4rem)] bg-white dark:bg-gray-900 text-gray-900 dark:text-white transition-width duration-300 ease-in-out z-40`}
            style={{
                visibility: isSidebarOpen ? 'visible' : 'hidden',
                overflow: 'hidden',
            }}
        >
            {isSidebarOpen && (
                <div className="flex flex-col h-full overflow-y-auto">
                    <div className="px-3 pb-3 pt-8">
                        {isClient ? (
                            <div className="client-sidebar-placeholder">
                                <div className="text-sm text-gray-500 italic px-4 py-2">
                                    Client View
                                </div>
                            </div>
                        ) : (
                            <>
                                <SidebarNav
                                    handleNavClick={handleNavClick}
                                    location={location}
                                    isDarkMode={isDarkMode}
                                    openTaskModal={openTaskModal}
                                />
                                <SidebarProjects
                                    handleNavClick={handleNavClick}
                                    location={location}
                                    isDarkMode={isDarkMode}
                                    openProjectModal={openProjectModal}
                                />
                                <SidebarNotes
                                    handleNavClick={handleNavClick}
                                    openNoteModal={openNoteModal}
                                    notes={notes}
                                    location={location}
                                    isDarkMode={isDarkMode}
                                />
                                
                                <SidebarHabits
                                    handleNavClick={handleNavClick}
                                    location={location}
                                    isDarkMode={isDarkMode}
                                    openNewHabit={openNewHabit}
                                />
                                
                                <SidebarAreas
                                    handleNavClick={handleNavClick}
                                    areas={areas}
                                    location={location}
                                    isDarkMode={isDarkMode}
                                    openAreaModal={openAreaModal}
                                />
                                <SidebarTags
                                    handleNavClick={handleNavClick}
                                    location={location}
                                    isDarkMode={isDarkMode}
                                    openTagModal={openTagModal}
                                    tags={tags}
                                />
                                <SidebarViews
                                    handleNavClick={handleNavClick}
                                    location={location}
                                    isDarkMode={isDarkMode}
                                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                                />
                                {/* 🔥 بداية الجزء الجديد الخاص بالأدمن فقط 🔥 */}
                                {currentUser?.role === 'admin' && (
                                    <div className="mt-4 mb-2">
                                        <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                            الإدارة
                                        </h3>
                                        <button
                                            onClick={() => handleNavClick('/admin/activity', 'مراقبة الإنتاجية')}
                                            className={`w-full flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                                                location.pathname === '/admin/activity'
                                                    ? 'bg-blue-50 text-blue-700 dark:bg-gray-800 dark:text-blue-400'
                                                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                                            }`}
                                        >
                                            {/* أيقونة رسم بياني (Chart) بتدل على الـ KPIs */}
                                            <svg className="mr-3 h-5 w-5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                            </svg>
                                            مراقبة الإنتاجية
                                        </button>
                                    </div>
                                )}
                                {/* 🔥 نهاية جزء الأدمن 🔥 */}
                            </>
                        )}
                    </div>

                    <SidebarFooter
                        currentUser={currentUser}
                        isDarkMode={isDarkMode}
                        toggleDarkMode={toggleDarkMode}
                        isSidebarOpen={isSidebarOpen}
                        setIsSidebarOpen={setIsSidebarOpen}
                        isDropdownOpen={isDropdownOpen}
                        toggleDropdown={toggleDropdown}
                        openTaskModal={openTaskModal}
                        openProjectModal={openProjectModal}
                        openNoteModal={openNoteModal}
                        openAreaModal={openAreaModal}
                        openTagModal={openTagModal}
                        keyboardShortcuts={keyboardShortcuts}
                    />
                </div>
            )}
        </div>
    );
};

export default Sidebar;