import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class CustomBadge extends StatelessWidget {
  final String text;
  final Color color;
  final Color? backgroundColor;
  final Color? borderColor;
  final IconData? icon;
  final double fontSize;
  final EdgeInsetsGeometry padding;

  const CustomBadge({
    super.key,
    required this.text,
    required this.color,
    this.backgroundColor,
    this.borderColor,
    this.icon,
    this.fontSize = 11,
    this.padding = const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
  });

  factory CustomBadge.success(String text, {IconData? icon}) {
    return CustomBadge(
      text: text,
      color: AppTheme.success,
      backgroundColor: AppTheme.successBg,
      borderColor: AppTheme.successBorder,
      icon: icon,
    );
  }

  factory CustomBadge.warning(String text, {IconData? icon}) {
    return CustomBadge(
      text: text,
      color: AppTheme.warning,
      backgroundColor: AppTheme.warningBg,
      borderColor: AppTheme.warningBorder,
      icon: icon,
    );
  }

  factory CustomBadge.danger(String text, {IconData? icon}) {
    return CustomBadge(
      text: text,
      color: AppTheme.danger,
      backgroundColor: AppTheme.dangerBg,
      borderColor: AppTheme.dangerBorder,
      icon: icon,
    );
  }

  factory CustomBadge.info(String text, {IconData? icon}) {
    return CustomBadge(
      text: text,
      color: AppTheme.info,
      backgroundColor: AppTheme.infoBg,
      borderColor: AppTheme.infoBorder,
      icon: icon,
    );
  }

  factory CustomBadge.newJoiner({String text = '< 6M Service'}) {
    return CustomBadge(
      text: text,
      color: Colors.white,
      backgroundColor: AppTheme.newJoinerBadge,
      borderColor: AppTheme.newJoinerBadge,
      icon: Icons.warning_amber_rounded,
      fontSize: 10,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: backgroundColor ?? color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: borderColor ?? color.withOpacity(0.3),
          width: 1,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: fontSize + 2, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            text,
            style: TextStyle(
              color: color,
              fontSize: fontSize,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.02,
            ),
          ),
        ],
      ),
    );
  }
}

