import Image from 'next/image';

type NexRestoLogoProps = {
    variant?: 'mark' | 'full';
    className?: string;
    priority?: boolean;
};

export default function NexRestoLogo({ variant = 'mark', className, priority = false }: NexRestoLogoProps) {
    if (variant === 'full') {
        return (
            <Image
                src="/nexresto-logo.svg"
                alt="NexResto"
                width={420}
                height={148}
                className={className}
                priority={priority}
            />
        );
    }

    return (
        <Image
            src="/nexresto-mark.svg"
            alt="NexResto"
            width={64}
            height={64}
            className={className}
            priority={priority}
        />
    );
}
