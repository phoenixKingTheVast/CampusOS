enum CourseTab {
  overview('overview', 'Overview'),
  announcements('announcements', 'Announcements'),
  resources('resources', 'Resources'),
  assignments('assignments', 'Assignments'),
  exams('exams', 'Tests & Exams'),
  laboratory('laboratory', 'Laboratory'),
  discussion('discussion', 'Discussion'),
  studyGroups('study-groups', 'Study Groups'),
  people('people', 'People');

  const CourseTab(this.path, this.label);

  final String path;
  final String label;

  bool get isPlaceholder => false;

  static CourseTab fromPath(String? path) {
    return CourseTab.values.firstWhere(
      (tab) => tab.path == path,
      orElse: () => CourseTab.overview,
    );
  }
}
