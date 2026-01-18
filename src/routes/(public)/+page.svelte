<script lang="ts">
	import {
		filterSessionsByDateRange,
		calculateDashboardMetrics,
		calculateVolumeTrends,
		calculateMuscleBreakdown,
		calculateDailyWorkouts,
		calculateDailyMetrics,
		getLastWorkoutDate,
		calculateWeeklyComparison,
		calculateMonthlyComparison
	} from '$lib/dashboardMetrics';
	import { Button, Card, MetricCard, ButtonGroup, PageHeader } from '$lib/ui';

	let { data } = $props();

	// Data from load function
	const sessions = $derived(data.sessions);
	const allExercises = $derived(data.allExercises);

	// UI state
	let dateFilter = $state<'week' | 'month' | 'year' | 'custom'>('month');
	let customStartDate = $state('');
	let customEndDate = $state('');
	let selectedPeriod = $state<'week' | 'month'>('week');

	const filteredSessions = $derived.by(() => {
		if (sessions.length === 0) return [];

		const now = new Date();
		let startDate: Date;

		switch (dateFilter) {
			case 'week':
				startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
				break;
			case 'month':
				startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
				break;
			case 'year':
				startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
				break;
			case 'custom':
				startDate = customStartDate ? new Date(customStartDate) : new Date(0);
				break;
			default:
				startDate = new Date(0);
		}

		let endDate = dateFilter === 'custom' && customEndDate ? new Date(customEndDate) : now;

		return filterSessionsByDateRange(sessions, startDate, endDate);
	});

	const metrics = $derived.by(() => calculateDashboardMetrics(filteredSessions));

	const totalSessions = $derived(metrics.totalSessions);
	const totalTrainingTime = $derived(metrics.totalTrainingTime);
	const totalVolume = $derived(metrics.totalVolume);
	const uniqueWorkouts = $derived(metrics.uniqueWorkouts);
	const averageDuration = $derived(metrics.averageDuration);

	const workoutCalendar = $derived.by(() => {
		return calculateDailyWorkouts(filteredSessions, 30);
	});

	const dailyMetrics = $derived.by(() => {
		return calculateDailyMetrics(filteredSessions, 30);
	});

	const lastWorkoutDate = $derived.by(() => getLastWorkoutDate(sessions));

	const muscleGroupBreakdown = $derived.by(() => {
		return calculateMuscleBreakdown(filteredSessions);
	});

	const volumeTrends = $derived.by(() => {
		const startDate = customStartDate ? new Date(customStartDate) : undefined;
		const endDate = customEndDate ? new Date(customEndDate) : undefined;
		return calculateVolumeTrends(filteredSessions, dateFilter, startDate, endDate);
	});

	const weeklyComparison = $derived.by(() => calculateWeeklyComparison(sessions));
	const monthlyComparison = $derived.by(() => calculateMonthlyComparison(sessions));

	function formatTime(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		if (hours > 0) {
			return `${hours}h ${mins}m`;
		}
		return `${mins}m`;
	}

	function formatVolume(lbs: number): string {
		if (lbs >= 1000) {
			return (lbs / 1000).toFixed(1) + 'k';
		}
		return lbs.toString();
	}

	function formatDateRange(start: Date, end: Date): string {
		const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
		const startStr = start.toLocaleDateString('en-US', options);
		const endStr = end.toLocaleDateString('en-US', options);
		return `${startStr} - ${endStr}`;
	}

	function getCalendarColor(count: number): string {
		if (count === 0) return 'bg-surface-elevated';
		if (count === 1) return 'bg-accent/30';
		if (count === 2) return 'bg-accent/60';
		return 'bg-accent';
	}

	function isLastWorkoutDate(dateStr: string): boolean {
		if (!lastWorkoutDate) return false;
		const lastDateStr = lastWorkoutDate.toISOString().split('T')[0];
		return dateStr === lastDateStr;
	}

	const pieChartData = $derived.by(() => {
		const total = muscleGroupBreakdown.reduce((acc, item) => acc + item.count, 0);
		let currentAngle = 0;

		return muscleGroupBreakdown.map(({ muscle, count }) => {
			const percentage = (count / total) * 100;
			const angle = (percentage / 100) * 360;
			const segment = {
				muscle,
				count,
				percentage,
				startAngle: currentAngle,
				endAngle: currentAngle + angle
			};
			currentAngle += angle;
			return segment;
		});
	});

	const dateFilterOptions = [
		{ value: 'week', label: 'Week' },
		{ value: 'month', label: 'Month' },
		{ value: 'year', label: 'Year' },
		{ value: 'custom', label: 'Custom' }
	];

	const periodOptions = [
		{ value: 'week', label: 'Week' },
		{ value: 'month', label: 'Month' }
	];
</script>

<div class="min-h-screen bg-bg p-3 sm:p-4 md:p-6 lg:p-8">
	<div class="max-w-7xl mx-auto w-full">
		{#if sessions.length === 0}
			<PageHeader title="Dashboard">
				{#snippet actions()}
					<Button variant="primary" href="/workout">
						Start
					</Button>
				{/snippet}
			</PageHeader>
			<Card class="mb-4 sm:mb-6 text-center" padding="lg">
				{#snippet children()}
					<div class="w-20 h-20 sm:w-24 sm:h-24 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
						<span class="text-4xl sm:text-5xl">🏋️</span>
					</div>
					<h2 class="text-xl sm:text-2xl font-bold font-display text-text-primary mb-2">Welcome to Your Gym Dashboard!</h2>
					<p class="text-text-secondary mb-4">Start tracking your workouts to see your daily metrics, volume trends, and progress over time.</p>
					<Button href="/workout">
						Start Your First Workout
					</Button>
				{/snippet}
			</Card>

			<!-- Quick Actions for new users -->
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
				<a href="/exercises" class="bg-surface border border-border rounded-xl p-4 hover:border-accent/50 hover:bg-accent/5 transition-all duration-200 group">
					<div class="text-2xl mb-2">💪</div>
					<div class="font-semibold text-text-primary group-hover:text-accent transition-colors">Exercises</div>
					<div class="text-xs text-text-muted">Browse & add</div>
				</a>
				<a href="/workout" class="bg-surface border border-border rounded-xl p-4 hover:border-success/50 hover:bg-success/5 transition-all duration-200 group">
					<div class="text-2xl mb-2">▶️</div>
					<div class="font-semibold text-text-primary group-hover:text-success transition-colors">Workout</div>
					<div class="text-xs text-text-muted">Start session</div>
				</a>
				<a href="/progress" class="bg-surface border border-border rounded-xl p-4 hover:border-secondary/50 hover:bg-secondary/5 transition-all duration-200 group">
					<div class="text-2xl mb-2">📈</div>
					<div class="font-semibold text-text-primary group-hover:text-secondary transition-colors">Progress</div>
					<div class="text-xs text-text-muted">Track gains</div>
				</a>
				<a href="/settings" class="bg-surface border border-border rounded-xl p-4 hover:border-border-active hover:bg-surface-elevated transition-all duration-200 group">
					<div class="text-2xl mb-2">⚙️</div>
					<div class="font-semibold text-text-primary group-hover:text-text-secondary transition-colors">Settings</div>
					<div class="text-xs text-text-muted">Preferences</div>
				</a>
			</div>
		{:else}
			<PageHeader title="Dashboard">
				{#snippet actions()}
					<Button variant="primary" href="/workout">
						▶ Start Workout
					</Button>
				{/snippet}
			</PageHeader>

			<div class="flex justify-end mb-4 sm:mb-6">
				<ButtonGroup
					options={dateFilterOptions}
					bind:value={dateFilter}
					onchange={(v) => dateFilter = v as typeof dateFilter}
				/>
			</div>

			<!-- Quick Actions -->
			<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
				<a href="/exercises" class="bg-surface border border-border rounded-xl p-4 hover:border-accent/50 hover:bg-accent/5 transition-all duration-200 group">
					<div class="text-2xl mb-2">💪</div>
					<div class="font-semibold text-text-primary group-hover:text-accent transition-colors">Exercises</div>
					<div class="text-xs text-text-muted">Browse & add</div>
				</a>
				<a href="/workout" class="bg-surface border border-border rounded-xl p-4 hover:border-success/50 hover:bg-success/5 transition-all duration-200 group">
					<div class="text-2xl mb-2">▶️</div>
					<div class="font-semibold text-text-primary group-hover:text-success transition-colors">Workout</div>
					<div class="text-xs text-text-muted">Start session</div>
				</a>
				<a href="/progress" class="bg-surface border border-border rounded-xl p-4 hover:border-secondary/50 hover:bg-secondary/5 transition-all duration-200 group">
					<div class="text-2xl mb-2">📈</div>
					<div class="font-semibold text-text-primary group-hover:text-secondary transition-colors">Progress</div>
					<div class="text-xs text-text-muted">History & PRs</div>
				</a>
				<a href="/settings" class="bg-surface border border-border rounded-xl p-4 hover:border-border-active hover:bg-surface-elevated transition-all duration-200 group">
					<div class="text-2xl mb-2">⚙️</div>
					<div class="font-semibold text-text-primary group-hover:text-text-secondary transition-colors">Settings</div>
					<div class="text-xs text-text-muted">Preferences</div>
				</a>
			</div>
		{/if}

		{#if dateFilter === 'custom'}
			<Card class="mb-4 sm:mb-6" padding="sm">
				{#snippet children()}
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
						<div>
							<label for="start-date" class="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
								Start Date
							</label>
							<input
								id="start-date"
								type="date"
								bind:value={customStartDate}
								class="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent text-sm text-text-primary min-h-[44px]"
							/>
						</div>
						<div>
							<label for="end-date" class="block text-xs sm:text-sm font-medium text-text-secondary mb-1">
								End Date
							</label>
							<input
								id="end-date"
								type="date"
								bind:value={customEndDate}
								class="w-full px-3 py-2.5 bg-surface-elevated border border-border rounded-lg focus:ring-2 focus:ring-accent focus:border-accent text-sm text-text-primary min-h-[44px]"
							/>
						</div>
					</div>
				{/snippet}
			</Card>
		{/if}

		{#if sessions.length > 0}
			<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-6">
				<MetricCard label="Sessions" value={totalSessions} icon="📊" iconBgColor="bg-secondary/20" />
				<MetricCard label="Time" value={formatTime(totalTrainingTime)} icon="⏱️" iconBgColor="bg-success/20" />
				<MetricCard label="Volume" value="{formatVolume(totalVolume)} lbs" icon="🏋️" iconBgColor="bg-accent/20" />
				<MetricCard
					label="Avg Duration"
					value={totalSessions > 0 ? formatTime(totalTrainingTime / totalSessions) : '0m'}
					icon="📈"
					iconBgColor="bg-warning/20"
				/>
			</div>

			<Card class="mb-4 sm:mb-6" padding="sm">
				{#snippet children()}
					<div class="flex items-center justify-between mb-3 sm:mb-4">
						<h2 class="text-lg sm:text-xl font-bold font-display text-text-primary">Training Aggregates</h2>
						<ButtonGroup
							options={periodOptions}
							bind:value={selectedPeriod}
							onchange={(v) => selectedPeriod = v as typeof selectedPeriod}
							size="sm"
						/>
					</div>

					{#if selectedPeriod === 'week'}
						<div class="space-y-3 sm:space-y-4">
							<div class="grid grid-cols-2 gap-3 sm:gap-4">
								<div class="bg-secondary/10 rounded-lg p-3 sm:p-4">
									<div class="flex items-center justify-between mb-2">
										<span class="text-xs sm:text-sm text-text-secondary">Volume</span>
										<span class="text-[10px] sm:text-xs text-text-muted">{formatDateRange(weeklyComparison.current.startDate, weeklyComparison.current.endDate)}</span>
									</div>
									<p class="text-lg sm:text-2xl font-bold font-display text-text-primary">{formatVolume(weeklyComparison.current.volume)} lbs</p>
									<div class="flex items-center gap-1 mt-1">
										{#if weeklyComparison.volumeChange > 0}
											<span class="text-accent text-xs sm:text-sm font-medium">↑</span>
											<span class="text-accent text-xs sm:text-sm font-medium">
												{weeklyComparison.volumeChangePercent > 0 ? '+' : ''}{weeklyComparison.volumeChangePercent.toFixed(1)}%
											</span>
										{:else if weeklyComparison.volumeChange < 0}
											<span class="text-danger text-xs sm:text-sm font-medium">↓</span>
											<span class="text-danger text-xs sm:text-sm font-medium">
												{weeklyComparison.volumeChangePercent.toFixed(1)}%
											</span>
										{:else}
											<span class="text-text-muted text-xs sm:text-sm">-</span>
										{/if}
									</div>
								</div>

								<div class="bg-accent/10 rounded-lg p-3 sm:p-4">
									<div class="flex items-center justify-between mb-2">
										<span class="text-xs sm:text-sm text-text-secondary">Workouts</span>
										<span class="text-[10px] sm:text-xs text-text-muted">vs. previous week</span>
									</div>
									<p class="text-lg sm:text-2xl font-bold font-display text-text-primary">{weeklyComparison.current.workoutCount}</p>
									<div class="flex items-center gap-1 mt-1">
										{#if weeklyComparison.workoutCountChange > 0}
											<span class="text-accent text-xs sm:text-sm font-medium">↑</span>
											<span class="text-accent text-xs sm:text-sm font-medium">
												+{weeklyComparison.workoutCountChange} ({weeklyComparison.workoutCountChangePercent > 0 ? '+' : ''}{weeklyComparison.workoutCountChangePercent.toFixed(1)}%)
											</span>
										{:else if weeklyComparison.workoutCountChange < 0}
											<span class="text-danger text-xs sm:text-sm font-medium">↓</span>
											<span class="text-danger text-xs sm:text-sm font-medium">
												{weeklyComparison.workoutCountChange} ({weeklyComparison.workoutCountChangePercent.toFixed(1)}%)
											</span>
										{:else}
											<span class="text-text-muted text-xs sm:text-sm">0 (0%)</span>
										{/if}
									</div>
								</div>
							</div>

							<div class="bg-surface-elevated rounded-lg p-2 sm:p-3">
								<span class="text-xs text-text-muted">Previous week: {formatDateRange(weeklyComparison.previous.startDate, weeklyComparison.previous.endDate)} - {formatVolume(weeklyComparison.previous.volume)} lbs, {weeklyComparison.previous.workoutCount} workouts</span>
							</div>
						</div>
					{:else}
						<div class="space-y-3 sm:space-y-4">
							<div class="grid grid-cols-2 gap-3 sm:gap-4">
								<div class="bg-secondary/10 rounded-lg p-3 sm:p-4">
									<div class="flex items-center justify-between mb-2">
										<span class="text-xs sm:text-sm text-text-secondary">Volume</span>
										<span class="text-[10px] sm:text-xs text-text-muted">{formatDateRange(monthlyComparison.current.startDate, monthlyComparison.current.endDate)}</span>
									</div>
									<p class="text-lg sm:text-2xl font-bold font-display text-text-primary">{formatVolume(monthlyComparison.current.volume)} lbs</p>
									<div class="flex items-center gap-1 mt-1">
										{#if monthlyComparison.volumeChange > 0}
											<span class="text-accent text-xs sm:text-sm font-medium">↑</span>
											<span class="text-accent text-xs sm:text-sm font-medium">
												{monthlyComparison.volumeChangePercent > 0 ? '+' : ''}{monthlyComparison.volumeChangePercent.toFixed(1)}%
											</span>
										{:else if monthlyComparison.volumeChange < 0}
											<span class="text-danger text-xs sm:text-sm font-medium">↓</span>
											<span class="text-danger text-xs sm:text-sm font-medium">
												{monthlyComparison.volumeChangePercent.toFixed(1)}%
											</span>
										{:else}
											<span class="text-text-muted text-xs sm:text-sm">-</span>
										{/if}
									</div>
								</div>

								<div class="bg-accent/10 rounded-lg p-3 sm:p-4">
									<div class="flex items-center justify-between mb-2">
										<span class="text-xs sm:text-sm text-text-secondary">Workouts</span>
										<span class="text-[10px] sm:text-xs text-text-muted">vs. previous month</span>
									</div>
									<p class="text-lg sm:text-2xl font-bold font-display text-text-primary">{monthlyComparison.current.workoutCount}</p>
									<div class="flex items-center gap-1 mt-1">
										{#if monthlyComparison.workoutCountChange > 0}
											<span class="text-accent text-xs sm:text-sm font-medium">↑</span>
											<span class="text-accent text-xs sm:text-sm font-medium">
												+{monthlyComparison.workoutCountChange} ({monthlyComparison.workoutCountChangePercent > 0 ? '+' : ''}{monthlyComparison.workoutCountChangePercent.toFixed(1)}%)
											</span>
										{:else if monthlyComparison.workoutCountChange < 0}
											<span class="text-danger text-xs sm:text-sm font-medium">↓</span>
											<span class="text-danger text-xs sm:text-sm font-medium">
												{monthlyComparison.workoutCountChange} ({monthlyComparison.workoutCountChangePercent.toFixed(1)}%)
											</span>
										{:else}
											<span class="text-text-muted text-xs sm:text-sm">0 (0%)</span>
										{/if}
									</div>
								</div>
							</div>

							<div class="bg-surface-elevated rounded-lg p-2 sm:p-3">
								<span class="text-xs text-text-muted">Previous month: {formatDateRange(monthlyComparison.previous.startDate, monthlyComparison.previous.endDate)} - {formatVolume(monthlyComparison.previous.volume)} lbs, {monthlyComparison.previous.workoutCount} workouts</span>
							</div>
						</div>
					{/if}
				{/snippet}
			</Card>

			<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
				<Card>
					{#snippet children()}
						<h2 class="text-lg sm:text-xl font-bold font-display text-text-primary mb-3 sm:mb-4">Daily Metrics</h2>
						{#if dailyMetrics.length > 0}
							<div class="space-y-2 max-h-64 overflow-y-auto">
								<div class="grid grid-cols-3 gap-2 text-xs font-semibold text-text-secondary border-b border-border pb-2">
									<span>Date</span>
									<span class="text-center">Workouts</span>
									<span class="text-right">Volume</span>
								</div>
								{#each [...dailyMetrics].reverse() as metric}
									<div
										class="grid grid-cols-3 gap-2 text-xs sm:text-sm py-1 {isLastWorkoutDate(metric.date)
											? 'bg-accent/10 border-l-4 border-accent'
											: 'bg-surface-elevated'} rounded"
									>
										<span class="truncate text-text-primary">{new Date(metric.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
										<span class="text-center {metric.workoutCount === 0 ? 'text-text-muted' : 'font-semibold text-text-primary'}">{metric.workoutCount}</span>
										<span class="text-right {metric.volume === 0 ? 'text-text-muted' : 'font-semibold text-accent'}">
											{formatVolume(metric.volume)} lbs
										</span>
									</div>
								{/each}
							</div>
							{#if lastWorkoutDate}
								<div class="mt-3 text-xs text-text-muted">
									Last workout: {lastWorkoutDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
								</div>
							{/if}
						{:else}
							<p class="text-text-muted text-center py-4 text-sm">No workout data available</p>
						{/if}
					{/snippet}
				</Card>

				<Card>
					{#snippet children()}
						<h2 class="text-lg sm:text-xl font-bold font-display text-text-primary mb-3 sm:mb-4">Muscle Breakdown</h2>
						{#if muscleGroupBreakdown.length > 0}
							<div class="flex items-center justify-center mb-3 sm:mb-4">
								<svg viewBox="0 0 100 100" class="w-32 h-32 sm:w-48 sm:h-48">
									{#each pieChartData as segment}
										{#if segment.percentage > 0}
											<path
												d="M 50 50 L {
													50 +
													45 *
													Math.cos(
														(segment.startAngle - 90) * (Math.PI / 180)
													)
												} {
													50 +
													45 *
													Math.sin(
														(segment.startAngle - 90) * (Math.PI / 180)
													)
												} A 45 45 0 {
													segment.percentage > 50 ? 1 : 0
												} 1 {
													50 +
													45 *
													Math.cos(
														(segment.endAngle - 90) * (Math.PI / 180)
													)
												} {
													50 +
													45 *
													Math.sin(
														(segment.endAngle - 90) * (Math.PI / 180)
													)
												} Z"
												fill={[
													'#3b82f6',
													'#10b981',
													'#f59e0b',
													'#ef4444',
													'#8b5cf6',
													'#ec4899',
													'#06b6d4'
												][muscleGroupBreakdown.findIndex((item) => item.muscle === segment.muscle)]}
												stroke="white"
												stroke-width="1"
											/>
										{/if}
									{/each}
								</svg>
							</div>
							<div class="grid grid-cols-2 gap-1 sm:gap-2">
								{#each muscleGroupBreakdown.slice(0, 6) as { muscle, count }}
									<div class="flex items-center justify-between p-2 bg-surface-elevated rounded">
										<span class="capitalize text-xs sm:text-sm text-text-primary">{muscle}</span>
										<span class="font-semibold text-xs sm:text-sm text-text-secondary">{count} ({(
											pieChartData.find((s) => s.muscle === muscle)?.percentage || 0
										).toFixed(0)}%)</span>
									</div>
								{/each}
							</div>
						{:else}
							<p class="text-text-muted text-center py-8 sm:py-12 text-sm">No workout data available</p>
						{/if}
					{/snippet}
				</Card>
			</div>

			<Card>
				{#snippet children()}
					<h2 class="text-lg sm:text-xl font-bold font-display text-text-primary mb-3 sm:mb-4">Volume Trends</h2>
					{#if volumeTrends.some((t) => t.volume > 0)}
						<div class="h-48 sm:h-64">
							<svg viewBox="0 0 800 200" class="w-full h-full">
								{#each volumeTrends as trend, i}
									{#if trend.volume > 0}
										<line
											x1={i * (800 / volumeTrends.length)}
											y1={200 - (trend.volume / Math.max(...volumeTrends.map((t) => t.volume))) * 180}
											x2={(i + 1) * (800 / volumeTrends.length)}
											y2={200 -
												(volumeTrends[i + 1]?.volume || trend.volume) /
													Math.max(...volumeTrends.map((t) => t.volume)) * 180}
											stroke="#c5ff00"
											stroke-width="2"
										/>
										<circle
											cx={i * (800 / volumeTrends.length) + 800 / volumeTrends.length / 2}
											cy={200 - (trend.volume / Math.max(...volumeTrends.map((t) => t.volume))) * 180}
											r="4"
											fill="#c5ff00"
										/>
									{/if}
								{/each}
								{#each volumeTrends as trend, i}
									<text
										x={i * (800 / volumeTrends.length) + 800 / volumeTrends.length / 2}
										y={195}
										text-anchor="middle"
										class="text-xs"
										fill="#8b8d97"
									>
										{i % 2 === 0 ? trend.date : ''}
									</text>
								{/each}
							</svg>
						</div>
						<div class="mt-3 sm:mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
							{#each volumeTrends.slice(-4).reverse() as trend}
								<div class="text-xs sm:text-sm">
									<p class="text-text-muted">{trend.date}</p>
									<p class="font-semibold text-text-primary">{formatVolume(trend.volume)} lbs</p>
									<p class="text-[10px] sm:text-xs text-text-muted">{trend.sessions} session{trend.sessions !== 1 ? 's' : ''}</p>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-text-muted text-center py-8 sm:py-12 text-sm">No volume data available</p>
					{/if}
				{/snippet}
			</Card>
		{/if}
	</div>
</div>
