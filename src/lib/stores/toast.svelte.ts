export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
	id: string;
	type: ToastType;
	message: string;
	duration?: number;
}

class ToastStore {
	toasts = $state<Toast[]>([]);

	add(message: string, type: ToastType = 'info', duration = 3000): string {
		const id = crypto.randomUUID();
		this.toasts.push({ id, type, message, duration });
		if (duration > 0) {
			setTimeout(() => this.remove(id), duration);
		}
		return id;
	}

	remove(id: string): void {
		this.toasts = this.toasts.filter((toast) => toast.id !== id);
	}

	clear(): void {
		this.toasts = [];
	}

	showSuccess(message: string, duration?: number): string {
		return this.add(message, 'success', duration);
	}

	showError(message: string, duration?: number): string {
		return this.add(message, 'error', duration);
	}

	showWarning(message: string, duration?: number): string {
		return this.add(message, 'warning', duration);
	}

	showInfo(message: string, duration?: number): string {
		return this.add(message, 'info', duration);
	}
}

export const toastStore = new ToastStore();
