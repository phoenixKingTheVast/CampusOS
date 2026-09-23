import 'package:campusos/app/providers.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/services/providers.dart';
import 'package:campusos/shared/models/booking.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:campusos/shared/widgets/skeleton_box.dart';
import 'package:campusos/shared/widgets/status_pill.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class BookingDetailScreen extends ConsumerStatefulWidget {
  const BookingDetailScreen({super.key, required this.bookingId});

  final String bookingId;

  @override
  ConsumerState<BookingDetailScreen> createState() => _BookingDetailScreenState();
}

class _BookingDetailScreenState extends ConsumerState<BookingDetailScreen> {
  String? _error;
  bool _busy = false;
  int _rating = 5;

  Future<void> _run(Future<Booking> Function() body) async {
    final online = ref.read(connectivityProvider).isOnline;
    if (!online) {
      setState(() {
        _error = "You're offline. Reconnect to send your response — nothing has been sent yet.";
      });
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await body();
      ref.invalidate(bookingDetailProvider(widget.bookingId));
    } on ApiError catch (error) {
      setState(() => _error = error.message);
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _act(Booking booking, String action) async {
    final repository = ref.read(bookingsRepositoryProvider);
    final id = booking.id;
    switch (action) {
      case 'CONFIRM':
        await _run(() => repository.confirm(id, online: true));
      case 'DECLINE':
        await _run(() => repository.decline(id, online: true));
      case 'START':
        await _run(() => repository.start(id, online: true));
      case 'COMPLETE':
        await _run(() => repository.complete(id, online: true));
      case 'CANCEL':
        await _run(() => repository.cancel(id, online: true));
      case 'OPEN_CONVERSATION':
        try {
          final route = await repository.conversationRoute(id, online: true);
          if (mounted) {
            context.push(route);
          }
        } on ApiError catch (error) {
          setState(() => _error = error.message);
        }
      case 'REVIEW':
        await _review(id);
      case 'RESCHEDULE':
        setState(() => _error = 'Pick a new time with the provider. This booking stays as it is until they confirm.');
      default:
        break;
    }
  }

  Future<void> _review(String bookingId) async {
    await _run(() async {
      await ref.read(bookingsRepositoryProvider).review(
            bookingId,
            rating: _rating,
            online: true,
          );
      return ref.read(bookingsRepositoryProvider).booking(bookingId, online: true);
    });
  }

  @override
  Widget build(BuildContext context) {
    final booking = ref.watch(bookingDetailProvider(widget.bookingId));
    final online = ref.watch(connectivityProvider).isOnline;

    return Scaffold(
      appBar: AppBar(title: const Text('Booking')),
      body: booking.when(
        loading: () => const HomeSkeleton(),
        error: (error, _) => ErrorRetry(
          message: error is ApiError ? error.message : ApiError.genericMessage,
          onRetry: () => ref.invalidate(bookingDetailProvider(widget.bookingId)),
        ),
        data: (item) => ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          children: [
            OfflineBanner(visible: !online || item.availableActions.isEmpty && !online),
            Text(item.service.title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            StatusPill(label: item.statusLabel),
            const SizedBox(height: 8),
            Text(item.stateLabel),
            if (item.customer != null) ...[
              const SizedBox(height: 8),
              Text(item.customer!.name),
            ],
            if (item.declineReason != null) Text(item.declineReason!),
            if (item.cancellationReason != null) Text(item.cancellationReason!),
            if (item.availableActions.isEmpty && !online)
              const EmptyState(
                title: 'Actions need a connection',
                subtitle:
                    "You're offline. Reconnect to send your response — nothing has been sent yet.",
              ),
            for (final action in item.availableActions)
              if (action != 'REVIEW')
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: CampusButton(
                    label: bookingActionLabels[action] ?? action,
                    busy: _busy,
                    secondary: action == 'CANCEL' || action == 'DECLINE',
                    onPressed: () => _act(item, action),
                  ),
                ),
            if (item.can('REVIEW')) ...[
              const SectionHeader('REVIEW'),
              Text('$_rating out of 5'),
              Slider(
                value: _rating.toDouble(),
                min: 1,
                max: 5,
                divisions: 4,
                label: '$_rating out of 5',
                onChanged: (value) => setState(() => _rating = value.round()),
              ),
              CampusButton(
                label: 'Leave a review',
                busy: _busy,
                onPressed: () => _act(item, 'REVIEW'),
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!),
            ],
          ],
        ),
      ),
    );
  }
}
