import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface ResponsiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}

const Modal = ({ isOpen, onClose, title, subtitle, children }: ResponsiveModalProps) => {
    // Keep your useEffect exactly the same...

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

    // 💡 FIX: Replace scale transforms with clean positional translations (y)
    // This stops Framer Motion from altering the box width/height model entirely
    const modalVariants = {
        hidden: isMobile ? { y: '100%' } : { opacity: 0 },
        visible: isMobile ? { y: 0 } : { opacity: 1 },
        exit: isMobile ? { y: '100%' } : { opacity: 0 }
    };

    if (typeof window === 'undefined') return null;

    return createPortal(
        <AnimatePresence mode="wait">
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center p-0 md:p-4">

                    {/* BACKDROP */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/40 backdrop-blur-xs cursor-pointer"
                    />

                    {/* MAIN MODAL CONTAINER */}
                    <motion.div
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        // 💡 Optional: tweak transition into an easeOut to match native UI layers
                        transition={{ type: 'tween', ease: 'easeOut', duration: 0.15 }}
                        drag={isMobile ? "y" : false}
                        dragConstraints={{ top: 0, bottom: 0 }}

                        dragTransition={{
                            bounceStiffness: 700, // 🔥 High stiffness forces the snap-back to be extremely fast
                            bounceDamping: 45,     // 🔥 High damping kills any trailing micro-vibration or bounce
                            power: 0              // 💡 Prevents your swipe momentum from extending the slide distance
                        }}

                        // 👇 FIX 2: Set top elasticity to 0 to completely eliminate upward rubber-banding 
                        dragElastic={{ top: 0, bottom: 0.5 }}
                        dragMomentum={false}
                        onDragEnd={(_, info) => {
                            if (info.offset.y > 140) onClose();
                        }}
                        className="relative z-10 w-full md:max-w-lg bg-bg-primary rounded-t-2xl md:rounded-2xl shadow-xl flex flex-col pointer-events-auto overflow-hidden"
                    >
                        {/* MOBILE DRAG BAR */}
                        <div className="flex md:hidden w-full justify-center py-3 cursor-grab active:cursor-grabbing shrink-0">
                            <div className="w-12 h-1.5 rounded-full bg-text-sub/20" />
                        </div>

                        {/* HEADER BLOCK */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-border-sub shrink-0">
                            {/* 💡 Note: layout="position" is safe to leave here, or remove if unneeded */}
                            <div className="flex flex-col min-w-0 pr-4">
                                <h2 className="text-lg font-bold text-text-main leading-tight truncate">{title}</h2>
                                {subtitle && <p className="text-xs text-text-sub mt-0.5 truncate">{subtitle}</p>}
                            </div>
                            <button
                                onClick={onClose}
                                className="p-1.5 text-text-sub hover:text-text-main hover:bg-item-hover rounded-lg transition-colors cursor-pointer shrink-0"
                            >
                                <X size={18} strokeWidth={2.5} />
                            </button>
                        </div>

                        {/* FLEXIBLE CONTENT STREAM */}
                        <div className="overflow-y-auto flex flex-col min-h-[80vh] md:min-h-[unset] max-h-[75vh] md:max-h-[95vh]">
                            {children}
                        </div>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default Modal;
