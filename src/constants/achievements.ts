import { Zap, Sun, Moon, Clock, Flame, Trophy } from 'lucide-react';

export interface Achievement {
    code: string;
    title: string;
    description: string;
    icon: React.ElementType;
    xpReward: number;
    /** two-letter code for the Pulse progress footer squares */
    short: string;
}

export const ACHIEVEMENTS_DATA: Achievement[] = [
    {
        code: 'early_bird',
        short: 'EB',
        title: 'Early Bird',
        description: 'Start activity before 7 AM',
        icon: Sun,
        xpReward: 50,
    },
    {
        code: 'night_owl',
        short: 'NO',
        title: 'Night Owl',
        description: 'Record activity after 10 PM',
        icon: Moon,
        xpReward: 50,
    },
    {
        code: 'deep_diver',
        short: 'DD',
        title: 'Deep Diver',
        description: '4 hours of contiguous focus',
        icon: Zap,
        xpReward: 100,
    },
    {
        code: 'consistency_king',
        short: 'CK',
        title: 'Consistency King',
        description: 'Maintain a 7-day streak',
        icon: Clock,
        xpReward: 200,
    },
    {
        code: 'streak_30',
        short: 'MM',
        title: 'Month Marathon',
        description: 'Maintain a 30-day streak',
        icon: Flame,
        xpReward: 500,
    },
    {
        code: 'streak_100',
        short: 'CC',
        title: 'Century Club',
        description: 'Maintain a 100-day streak',
        icon: Trophy,
        xpReward: 2000,
    },
];
