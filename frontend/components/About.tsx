import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    GlobeAltIcon, 
    EnvelopeIcon, 
    SparklesIcon, 
    CpuChipIcon,
    ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { getApiPath } from '../config/paths';

interface AboutProps {
    isDarkMode?: boolean;
}

const About: React.FC<AboutProps> = ({ isDarkMode = false }) => {
    const { t } = useTranslation();
    const [version, setVersion] = useState<string>('1.0.0');

    useEffect(() => {
        fetch(getApiPath('version'))
            .then((response) => response.json())
            .then((data) => {
                if (data.version) {
                    setVersion(data.version);
                }
            })
            .catch((error) => console.error('Error fetching version:', error));
    }, []);

    return (
        <div className="relative w-full min-h-[80vh] flex flex-col items-center px-4 sm:px-6 lg:px-8 pt-12 pb-20 overflow-hidden">
            
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-r from-blue-500/20 to-purple-600/20 dark:from-blue-600/10 dark:to-purple-800/10 rounded-full blur-3xl pointer-events-none opacity-70 animate-pulse"></div>
            
            <div className="relative z-10 w-full max-w-4xl mx-auto">
                
                {/* Hero Section */}
                <div className="text-center mb-16 transform transition-all duration-700 hover:scale-[1.02]">
                    <div className="flex justify-center mb-6 relative">
                        <div className="absolute inset-0 bg-white/20 dark:bg-white/5 blur-2xl rounded-full"></div>
                        <img
                            src={isDarkMode ? '/wide-logo-light.png' : '/wide-logo-dark.png'}
                            alt="Tasksten Logo"
                            className="h-20 w-auto relative z-10 drop-shadow-xl"
                        />
                    </div>
                    
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
                        Tungsten Media Internal 
                    </h1>
                    
                    <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-white/60 dark:bg-gray-800/60 backdrop-blur-md border border-gray-200 dark:border-gray-700 shadow-sm">
                        <span className="flex w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {t('about.version', 'System Version')} {version}
                        </p>
                    </div>
                </div>

                {/* Main Mission Card (Glassmorphism) */}
                <div className="relative mb-12 group">
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent dark:from-blue-500/5 rounded-3xl transform transition-transform duration-500 group-hover:scale-[1.01]"></div>
                    <div className="relative bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl border border-white/40 dark:border-gray-700/50 rounded-3xl p-8 md:p-10 shadow-2xl shadow-blue-500/5">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <SparklesIcon className="w-10 h-10 text-blue-500 dark:text-blue-400 mb-2" />
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                                {t('about.madeWithLove', 'Engineered for Tungsten Media')}
                            </h2>
                            <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed max-w-2xl">
                                {t(
                                    'about.description',
                                    'The ultimate Marketing Agency OS. Tasksten unites advanced task management, strict role-based access control, and seamless team collaboration into one powerful, distraction-free environment.'
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
                    <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg border border-gray-100 dark:border-gray-700/50 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4 group-hover:bg-blue-500 transition-colors duration-300">
                            <CpuChipIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors duration-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Automated Workflows</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                            Designed specifically for Account Managers and Media Buyers to streamline daily operations and eliminate bottlenecks.
                        </p>
                    </div>

                    <div className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg border border-gray-100 dark:border-gray-700/50 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 group">
                        <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-4 group-hover:bg-purple-500 transition-colors duration-300">
                            <ShieldCheckIcon className="w-6 h-6 text-purple-600 dark:text-purple-400 group-hover:text-white transition-colors duration-300" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Enterprise Security</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                            Proprietary RBAC architecture ensuring absolute data privacy and controlled client visibility across all projects.
                        </p>
                    </div>
                </div>

                {/* Agency Resources Links */}
                <div className="mb-16">
                    <h3 className="text-sm font-bold tracking-widest text-gray-400 dark:text-gray-500 uppercase text-center mb-6">
                        {t('about.agencyLinks', 'Internal Resources')}
                    </h3>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <a
                            href="https://tungsten-media.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center px-6 py-3.5 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 dark:text-gray-900 text-white rounded-xl transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                        >
                            <GlobeAltIcon className="w-5 h-5 mr-2 opacity-80" />
                            Tungsten Website
                        </a>
                        <a
                            href="mailto:support@tungstenmedia.com"
                            className="flex items-center justify-center px-6 py-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 text-gray-700 dark:text-gray-200 rounded-xl transition-all duration-200 font-semibold shadow-sm hover:shadow-md transform hover:-translate-y-0.5 group"
                        >
                            <EnvelopeIcon className="w-5 h-5 mr-2 text-gray-400 group-hover:text-blue-500 transition-colors" />
                            IT Support Desk
                        </a>
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center pt-8 border-t border-gray-200/50 dark:border-gray-800/50">
                    <div className="mb-4">
                        <span className="inline-flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-800/50 text-xs font-semibold text-gray-500 dark:text-gray-400 rounded-full border border-gray-200 dark:border-gray-700 backdrop-blur-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-2"></span>
                            {t('about.license', 'Proprietary License - Internal Use Only')}
                        </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                        {t('about.builtBy', 'Engineered by')}{' '}
                        <span className="font-bold text-gray-800 dark:text-gray-300">
                            Tungsten Media Tech Team (Roland & Mario)😎✌🏻
                        </span>
                    </p>
                </div>

            </div>
        </div>
    );
};

export default About;