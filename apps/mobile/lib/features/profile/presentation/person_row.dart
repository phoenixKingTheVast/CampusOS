import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/shared/models/social.dart';
import 'package:campusos/shared/widgets/person_avatar.dart';
import 'package:flutter/material.dart';

/// Initials stand in for the profile photo everywhere in the social graph: the
/// client has no renderer for `photoFileId` yet.
String personInitials(String name) {
  final cleaned = name.trim().replaceFirst(RegExp(r'^@'), '');
  final parts =
      cleaned.split(RegExp(r'\s+')).where((part) => part.isNotEmpty).toList();
  if (parts.isEmpty) {
    return 'C';
  }
  if (parts.length == 1) {
    return parts.first.substring(0, 1).toUpperCase();
  }
  return (parts.first.substring(0, 1) + parts.last.substring(0, 1))
      .toUpperCase();
}

/// One person in a followers, following, connections, blocked or connection
/// request list. The identity is a single focusable node; each action keeps its
/// own node and follows the identity in the reading order.
class PersonRow extends StatelessWidget {
  const PersonRow({
    super.key,
    required this.person,
    this.subtitle,
    this.onTap,
    this.actions = const [],
  });

  final PersonCard person;
  final String? subtitle;
  final VoidCallback? onTap;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    final detail =
        [person.handle, subtitle].whereType<String>().join(' · ');
    final spoken = [
      person.name,
      if (detail.isNotEmpty) detail,
      if (onTap != null) 'View profile',
    ].join('. ');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          button: onTap != null,
          label: spoken,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(12),
            child: ExcludeSemantics(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 10),
                child: Row(
                  children: [
                    PersonAvatar(initials: personInitials(person.name), size: 44),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            person.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              color: AppColors.navy,
                            ),
                          ),
                          if (detail.isNotEmpty)
                            Text(
                              detail,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.muted,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (actions.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(left: 56, bottom: 6),
            child: Wrap(
              spacing: 12,
              runSpacing: 4,
              children: actions,
            ),
          ),
      ],
    );
  }
}

/// The confirmation every destructive social action goes through. The copy is
/// the caller's, so each dialog can state exactly what the server will do.
Future<bool> confirmSocialAction(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
  bool destructive = true,
}) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (dialogContext) {
      return AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          Semantics(
            button: true,
            label: 'Cancel',
            child: TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Cancel'),
            ),
          ),
          Semantics(
            button: true,
            label: confirmLabel,
            child: TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(true),
              style: TextButton.styleFrom(
                foregroundColor:
                    destructive ? AppColors.danger : AppColors.deepGreen,
              ),
              child: Text(confirmLabel),
            ),
          ),
        ],
      );
    },
  );
  return confirmed ?? false;
}
