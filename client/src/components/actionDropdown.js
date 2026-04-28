"use client";
import { useState, useRef, useEffect, useMemo } from "react";

export function ActionsDropdown({ event, canEdit, onEdit, onDelete, onView, actions }) {
    const [open, setOpen] = useState(false);
    const [coords, setCoords] = useState({ x: 0, y: 0 });
    const buttonRef = useRef(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (open && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setCoords({
                x: rect.right - 130, // Adjust horizontal alignment
                y: rect.bottom + window.scrollY + 5, // Offset below button
            });
        }
    }, [open]);

    useEffect(() => {
        const closeOnOutsideClick = (e) => {
            if (!buttonRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) {
                setOpen(false);
            }
        };
        window.addEventListener("click", closeOnOutsideClick);
        return () => window.removeEventListener("click", closeOnOutsideClick);
    }, []);

    // build default actions array conditionally (no invalid inline `if` in array)
    const defaultActions = useMemo(() => {
        const list = [
            {
                label: "Details",
                onClick: () => onView?.(event),
            },
        ];
        if (canEdit) {
            list.push({
                label: "Edit",
                onClick: () => onEdit?.(event),
            });
        }
        list.push({
            label: "Delete",
            onClick: () => onDelete?.(event?._id),
            danger: true,
        });
        return list;
    }, [event, onEdit, onDelete, onView]);

    const renderActions = Array.isArray(actions) && actions.length ? actions : defaultActions;

    return (
        <>
            <button
                ref={buttonRef}
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen(!open);
                }}
                className="px-3 py-1 rounded bg-primary text-secondary text-sm"
            >
                Actions ▾
            </button>

            {open && (
                <div
                    ref={dropdownRef}
                    style={{
                        position: "fixed",
                        top: coords.y,
                        left: coords.x,
                        zIndex: 9999,
                    }}
                    className="w-40 rounded-xl bg-gray-800 text-white text-sm shadow-lg"
                >
                    {renderActions.map((a, i) => (
                        <button
                            key={i}
                            onClick={(ev) => {
                                ev.stopPropagation();
                                try {
                                    a.onClick?.();
                                } finally {
                                    setOpen(false);
                                }
                            }}
                            className={`block w-full text-left px-4 py-2 hover:bg-gray-700 ${a.danger ? "text-red-300" : ""} ${a.disabled ? "opacity-40 pointer-events-none" : ""}`}
                        >
                            {a.label}
                        </button>
                    ))}
                </div>
            )}
        </>
    );
}