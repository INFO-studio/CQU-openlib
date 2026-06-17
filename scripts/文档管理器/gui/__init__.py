"""
GUI包初始化文件
"""

_LAZY_EXPORTS = {
    "MainWindow": "gui.main_window",
    "Sidebar": "gui.sidebar",
    "DashboardView": "gui.views.dashboard",
    "CourseManagerView": "gui.views.course_manager",
    "StagingAreaView": "gui.views.staging_area",
    "BackupAreaView": "gui.views.backup_area",
    "CourseTableModel": "gui.models.course_model",
    "AddResourceDialog": "gui.dialogs.add_resource_dialog",
    "CreateCourseDialog": "gui.dialogs.create_course_dialog",
}

__all__ = list(_LAZY_EXPORTS)


def __getattr__(name):
    if name not in _LAZY_EXPORTS:
        raise AttributeError(name)

    from importlib import import_module

    module = import_module(_LAZY_EXPORTS[name])
    value = getattr(module, name)
    globals()[name] = value
    return value
