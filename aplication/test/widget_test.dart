import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';
import 'package:attendpro/main.dart';
import 'package:attendpro/services/auth_provider.dart';

void main() {
  testWidgets('AttendProApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider(create: (_) => AuthProvider()),
        ],
        child: const AttendProApp(),
      ),
    );

    expect(find.text('AttendPro ERP'), findsOneWidget);
  });
}
