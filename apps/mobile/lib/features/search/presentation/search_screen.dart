import 'dart:async';

import 'package:campusos/app/providers.dart';
import 'package:campusos/app/theme/app_theme.dart';
import 'package:campusos/shared/models/search_result.dart';
import 'package:campusos/shared/widgets/empty_state.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key, this.initialType});

  final String? initialType;

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _controller = TextEditingController();
  late SearchCategory _category;
  List<SearchHit> _hits = const [];
  List<String> _recent = const [];
  bool _busy = false;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _category = SearchCategory.fromApiType(widget.initialType);
    _loadRecent();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  Future<void> _loadRecent() async {
    final items = await ref.read(searchRepositoryProvider).recent();
    if (mounted) {
      setState(() => _recent = items);
    }
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    if (value.trim().length < 2) {
      setState(() => _hits = const []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), () => _search(value));
  }

  Future<void> _search(String query) async {
    setState(() => _busy = true);
    final online = ref.read(connectivityProvider).isOnline;
    final hits = await ref.read(searchRepositoryProvider).search(
          query: query,
          type: _category.apiType,
          online: online,
        );
    if (!mounted) {
      return;
    }
    setState(() {
      _hits = hits;
      _busy = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final online = ref.watch(connectivityProvider).isOnline;
    return Scaffold(
      appBar: AppBar(title: const Text('Search')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
            child: Semantics(
              textField: true,
              label: 'Search CampusOS',
              child: TextField(
                controller: _controller,
                autofocus: true,
                textInputAction: TextInputAction.search,
                decoration: const InputDecoration(
                  hintText: 'Search courses, people, events...',
                  prefixIcon: Icon(Icons.search),
                ),
                onSubmitted: _search,
                onChanged: _onQueryChanged,
              ),
            ),
          ),
          const SizedBox(height: 8),
          SizedBox(
            height: 40,
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              scrollDirection: Axis.horizontal,
              itemBuilder: (context, index) {
                final category = SearchCategory.all[index];
                final selected = category.apiType == _category.apiType;
                return Semantics(
                  button: true,
                  selected: selected,
                  label: category.label,
                  child: ChoiceChip(
                    label: Text(category.label),
                    selected: selected,
                    onSelected: (_) {
                      setState(() => _category = category);
                      if (_controller.text.trim().length >= 2) {
                        _search(_controller.text);
                      }
                    },
                  ),
                );
              },
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemCount: SearchCategory.all.length,
            ),
          ),
          if (!online)
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: Text(
                'Offline search — showing saved and recently synced content.',
                style: TextStyle(color: AppColors.muted),
              ),
            ),
          if (_busy) const LinearProgressIndicator(),
          Expanded(
            child: _controller.text.trim().length < 2
                ? ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      const SectionHeader('Recent searches'),
                      if (_recent.isEmpty)
                        const EmptyState(
                          title: 'Search CampusOS',
                          subtitle: 'Find courses, people, events and resources.',
                        )
                      else
                        ..._recent.map(
                          (query) => ListTile(
                            title: Text(query),
                            leading: const Icon(Icons.history),
                            onTap: () {
                              _controller.text = query;
                              _search(query);
                            },
                          ),
                        ),
                    ],
                  )
                : _hits.isEmpty && !_busy
                    ? const Padding(
                        padding: EdgeInsets.all(20),
                        child: EmptyState(
                          title: 'No results',
                          subtitle: 'Try another name, course code or resource title.',
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(20),
                        itemCount: _hits.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, index) {
                          final hit = _hits[index];
                          return Semantics(
                            button: true,
                            label: [
                              hit.title,
                              hit.kindLabel,
                              if (hit.historical) 'Historical',
                              hit.subtitle,
                            ].whereType<String>().join(', '),
                            child: ListTile(
                              title: Text(hit.title),
                              subtitle: Text(
                                [
                                  hit.kindLabel,
                                  if (hit.historical) 'Historical',
                                  hit.subtitle,
                                ].whereType<String>().join(' · '),
                              ),
                              onTap: hit.route == null ? null : () => context.push(hit.route!),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
