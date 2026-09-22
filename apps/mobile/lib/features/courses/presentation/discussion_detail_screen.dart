import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/core/network/api_error.dart';
import 'package:campusos/features/courses/providers.dart';
import 'package:campusos/shared/widgets/campus_button.dart';
import 'package:campusos/shared/widgets/campus_text_field.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

class DiscussionDetailScreen extends ConsumerStatefulWidget {
  const DiscussionDetailScreen({super.key, required this.discussionId});

  final String discussionId;

  @override
  ConsumerState<DiscussionDetailScreen> createState() => _DiscussionDetailScreenState();
}

class _DiscussionDetailScreenState extends ConsumerState<DiscussionDetailScreen> {
  final _reply = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _reply.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final body = _reply.text.trim();
    if (body.isEmpty) {
      return;
    }
    setState(() => _busy = true);
    try {
      await ref.read(courseRepositoryProvider).replyToDiscussion(
            discussionId: widget.discussionId,
            body: body,
          );
      _reply.clear();
      ref.invalidate(discussionProvider(widget.discussionId));
    } on ApiError catch (error) {
      setState(() => _error = error.message);
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(discussionProvider(widget.discussionId));
    return async.when(
      loading: () => const Scaffold(body: Center(child: CircularProgressIndicator())),
      error: (error, _) => Scaffold(
        appBar: AppBar(),
        body: EmptyState(
          title: 'This discussion is no longer available.',
          message: error is ApiError ? error.message : '$error',
        ),
      ),
      data: (item) {
        final canReply = (item.permissions?.canReplyDiscussion ?? true) && !item.closed;
        return Scaffold(
          appBar: AppBar(title: const Text('Discussion')),
          body: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(item.title, style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(
                [
                  item.authorName,
                  if (item.createdAt != null) DateFormat.yMMMd().add_jm().format(item.createdAt!.toLocal()),
                  if (item.closed) 'Closed',
                ].whereType<String>().join(' · '),
                style: const TextStyle(color: AppColors.muted),
              ),
              const SizedBox(height: 16),
              Text(item.body, style: const TextStyle(fontSize: 16, height: 1.4)),
              const SizedBox(height: 24),
              Text(
                '${item.replies.length} ${item.replies.length == 1 ? 'reply' : 'replies'}',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              if (item.replies.isEmpty)
                const Padding(
                  padding: EdgeInsets.only(top: 8),
                  child: Text('No replies yet.', style: TextStyle(color: AppColors.muted)),
                ),
              ...item.replies.map(
                (reply) => Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        [
                          reply.authorName,
                          if (reply.createdAt != null) DateFormat.MMMd().add_jm().format(reply.createdAt!.toLocal()),
                        ].whereType<String>().join(' · '),
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      Text(reply.body),
                    ],
                  ),
                ),
              ),
              if (canReply) ...[
                const SizedBox(height: 20),
                CampusTextField(label: 'Reply', controller: _reply, maxLines: 3),
                if (_error != null) Text(_error!),
                const SizedBox(height: 12),
                CampusButton(label: 'Post reply', busy: _busy, onPressed: _send),
              ] else if (item.closed)
                const Padding(
                  padding: EdgeInsets.only(top: 16),
                  child: Text('This discussion is closed.'),
                ),
              const SizedBox(height: 20),
              CampusButton(
                label: 'Open course',
                secondary: true,
                onPressed: () => context.go('/app/learn/course/${item.courseOfferingId}/discussion'),
              ),
            ],
          ),
        );
      },
    );
  }
}
